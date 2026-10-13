import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/main.js';

process.env.ORION_DISABLE_WORKER = '1';

let app: INestApplication;
let token: string;
const server = () => app.getHttpServer();

beforeAll(async () => {
  app = await createApp();
  await app.init();
  const res = await request(server()).post('/v1/auth/dev-login').send({ userId: 'u_alberto' }).expect(200);
  token = res.body.accessToken;
});

afterAll(async () => {
  await app.close();
});

describe('API v1 (simulación)', () => {
  it('sin sesión responde 401 con envelope estable', async () => {
    const res = await request(server()).get('/v1/me').expect(401);
    expect(res.body).toMatchObject({ code: 'UNAUTHENTICATED', requestId: expect.any(String) });
  });

  it('lista negocios autorizados con permisos y vocabulario por profesión', async () => {
    const res = await request(server()).get('/v1/me/businesses').set('authorization', `Bearer ${token}`).expect(200);
    const luna = res.body.find((m: { businessId: string }) => m.businessId === 'biz_luna');
    expect(luna.vocabulary.customerPlural).toBe('Pacientes');
    expect(res.body.find((m: { businessId: string }) => m.businessId === 'biz_orbita').features).toEqual({ loyalty: true, campaigns: true });
  });

  it('crea una cita con disponibilidad real y responde 409 al repetir horario con otra clave', async () => {
    const auth = { authorization: `Bearer ${token}` };
    const home = await request(server()).get('/v1/businesses/biz_orbita/home').set(auth).expect(200);
    const date: string = home.body.date;
    const avail = await request(server())
      .get('/v1/businesses/biz_orbita/availability')
      .query({ serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', date })
      .set(auth)
      .expect(200);
    const slot = avail.body.slots.at(-1);
    expect(slot).toBeDefined();
    const body = { customerId: 'cus_008', serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: slot.startsAt };
    const created = await request(server())
      .post('/v1/businesses/biz_orbita/appointments')
      .set(auth)
      .send({ ...body, requestId: 'e2e-req-0001' })
      .expect(201);
    expect(created.body.status).toBe('CONFIRMED');
    const conflict = await request(server())
      .post('/v1/businesses/biz_orbita/appointments')
      .set(auth)
      .send({ ...body, requestId: 'e2e-req-0002' })
      .expect(409);
    expect(conflict.body.code).toBe('SLOT_UNAVAILABLE');
    const op = await request(server()).get('/v1/operations/e2e-req-0001').set(auth).expect(200);
    expect(op.body.status).toBe('SUCCEEDED');
  });

  it('un profesional no ve agenda ajena ni otro negocio', async () => {
    const ana = (await request(server()).post('/v1/auth/dev-login').send({ userId: 'u_ana' })).body.accessToken;
    await request(server())
      .get('/v1/businesses/biz_orbita/appointments')
      .query({ from: '2026-10-12', professionalId: 'pro_luis' })
      .set('authorization', `Bearer ${ana}`)
      .expect(403);
    await request(server()).get('/v1/businesses/biz_luna/home').set('authorization', `Bearer ${ana}`).expect(403);
  });

  it('logout revoca el token', async () => {
    const t = (await request(server()).post('/v1/auth/dev-login').send({ userId: 'u_rocio' })).body.accessToken;
    await request(server()).post('/v1/auth/logout').set('authorization', `Bearer ${t}`).expect(204);
    await request(server()).get('/v1/me').set('authorization', `Bearer ${t}`).expect(401);
  });
});
