import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it } from 'vitest';
import { ANONYMIZED_CUSTOMER_NAME } from '@orion/contracts';
import { createSimulationContainer, type OrionContainer } from '../src/container.js';
import { ManualClock } from '../src/domain/clock.js';
import { SequentialIdGenerator } from '../src/domain/ids.js';
import type { ActorContext } from '../src/domain/model.js';
import { ORBITA, ZONE } from '../src/fixtures/seed.js';

const START = DateTime.fromISO('2026-10-12T09:41:00', { zone: ZONE }).toJSDate();
const MARIANA = 'cus_001';
const FERNANDA = 'cus_009';

let c: OrionContainer;
let owner: ActorContext;
let rocio: ActorContext;
let ana: ActorContext;
let rid = 0;
const req = () => `prv-${String(++rid).padStart(6, '0')}`;

beforeEach(async () => {
  c = createSimulationContainer(new ManualClock(START), new SequentialIdGenerator());
  owner = await c.access.resolveActor('u_alberto', ORBITA, 'test');
  rocio = await c.access.resolveActor('u_rocio', ORBITA, 'test');
  ana = await c.access.resolveActor('u_ana', ORBITA, 'test');
});

describe('Consentimiento promocional (sección 14)', () => {
  it('otorgar exige constancia; cada cambio queda en el historial con quién y cómo', async () => {
    const created = await c.customers.create(rocio, { requestId: req(), name: 'Nadia Robles', phone: '+52 669 555 0101' });
    expect(created.promotionalConsent).toBe('NOT_GRANTED');
    expect(created.consentHistory).toEqual([]);

    await expect(c.privacy.updateConsent(rocio, created.id, { requestId: req(), status: 'GRANTED' })).rejects.toThrow();

    const granted = await c.privacy.updateConsent(rocio, created.id, { requestId: req(), status: 'GRANTED', evidence: 'Lo aceptó en mostrador' });
    expect(granted.promotionalConsent).toBe('GRANTED');
    const revoked = await c.privacy.updateConsent(rocio, created.id, { requestId: req(), status: 'REVOKED', source: 'CUSTOMER_REQUEST' });
    expect(revoked.promotionalConsent).toBe('REVOKED');
    expect(revoked.consentHistory.map((e) => [e.status, e.sourceLabel, e.actorName])).toEqual([
      ['REVOKED', 'Solicitud del cliente', 'Rocío'],
      ['GRANTED', 'Registrado por el equipo', 'Rocío'],
    ]);
  });

  it('un profesional no puede cambiar consentimientos', async () => {
    await expect(c.privacy.updateConsent(ana, MARIANA, { requestId: req(), status: 'REVOKED' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('Solicitudes de derechos', () => {
  it('solo dueño y administración gestionan solicitudes; recepción no', async () => {
    await expect(c.privacy.overview(rocio)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const o = await c.privacy.overview(owner);
    expect(o.openRequests.map((r) => r.id)).toEqual(['prv_seed_1', 'prv_seed_2']);
    expect(o.pendingPolicies.length).toBeGreaterThan(0);
    expect(o.consent.granted + o.consent.notGranted + o.consent.revoked).toBeGreaterThan(100);
  });

  it('atender una oposición registra la baja promocional automáticamente', async () => {
    expect((await c.customers.get(owner, FERNANDA)).promotionalConsent).toBe('GRANTED');
    await expect(c.privacy.transition(owner, 'prv_seed_1', 'complete', { requestId: req() })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const done = await c.privacy.transition(owner, 'prv_seed_1', 'complete', { requestId: req(), note: 'Se dio de baja de promociones; seguirá recibiendo recordatorios.' });
    expect(done.status).toBe('COMPLETED');
    expect(done.allowedActions).toEqual([]);
    const f = await c.customers.get(owner, FERNANDA);
    expect(f.promotionalConsent).toBe('REVOKED');
    expect(f.consentHistory[0]).toMatchObject({ status: 'REVOKED', source: 'CUSTOMER_REQUEST' });
    await expect(c.privacy.transition(owner, 'prv_seed_1', 'reject', { requestId: req(), note: 'x'.repeat(5) })).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('una cancelación no se da por atendida hasta eliminar los datos', async () => {
    const r = await c.privacy.getRequest(owner, 'prv_seed_2');
    expect(r.completionBlocker).toMatch(/elimina los datos/);
    await expect(c.privacy.transition(owner, r.id, 'complete', { requestId: req(), note: 'Datos eliminados.' })).rejects.toMatchObject({ code: 'POLICY_VIOLATION' });

    await expect(c.privacy.anonymize(owner, r.customer.id, { requestId: req(), privacyRequestId: r.id, confirmName: 'Otro nombre' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const anon = await c.privacy.anonymize(owner, r.customer.id, { requestId: req(), privacyRequestId: r.id, confirmName: r.customer.name });
    expect(anon).toMatchObject({ name: ANONYMIZED_CUSTOMER_NAME, phone: null, email: null, note: null, promotionalConsent: 'REVOKED', anonymized: true });

    const done = await c.privacy.transition(owner, r.id, 'complete', { requestId: req(), note: 'Datos eliminados; se conservan citas sin identificar.' });
    expect(done.status).toBe('COMPLETED');
    // Ya no aparece en listas ni búsquedas.
    const list = await c.customers.list(owner, { q: r.customer.name, limit: 100 });
    expect(list.items.some((i) => i.id === r.customer.id)).toBe(false);
  });

  it('no se eliminan datos de un cliente con citas próximas', async () => {
    const m = await c.customers.get(owner, MARIANA);
    expect(m.nextAppointment).not.toBeNull();
    await expect(c.privacy.anonymize(owner, MARIANA, { requestId: req(), confirmName: 'Mariana López' })).rejects.toMatchObject({ code: 'POLICY_VIOLATION' });
  });

  it('crear, iniciar y rechazar una solicitud deja historial', async () => {
    const created = await c.privacy.createRequest(owner, { requestId: req(), customerId: MARIANA, type: 'RECTIFICATION', channel: 'PHONE', details: 'Su correo cambió.' });
    expect(created).toMatchObject({ status: 'RECEIVED', typeLabel: 'Rectificación', channelLabel: 'Teléfono', daysOpen: 0 });
    const started = await c.privacy.transition(owner, created.id, 'start', { requestId: req() });
    expect(started.allowedActions).toEqual(['complete', 'reject']);
    const rejected = await c.privacy.transition(owner, created.id, 'reject', { requestId: req(), note: 'No se pudo verificar la identidad.' });
    expect(rejected.history.map((h) => h.status)).toEqual(['RECEIVED', 'IN_PROGRESS', 'REJECTED']);
  });
});

describe('Exportación de datos (acceso)', () => {
  it('incluye datos de contacto, consentimientos, citas y solicitudes; solo con privacy.manage', async () => {
    await expect(c.privacy.exportCustomer(rocio, MARIANA)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const carmen = await c.access.resolveActor('u_carmen', ORBITA, 'test');
    const exp = await c.privacy.exportCustomer(carmen, MARIANA);
    expect(exp.format).toBe('orion.customer-export.v1');
    expect(exp.customer).toMatchObject({ name: 'Mariana López', anonymized: false });
    expect(exp.customer.phone).toMatch(/^\+52/);
    expect(exp.appointments.length).toBeGreaterThan(0);
    expect(exp.consentHistory.length).toBeGreaterThan(0);
    expect(exp.exportedBy).toBe('Carmen');
  });
});
