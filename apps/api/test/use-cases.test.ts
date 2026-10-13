import { beforeEach, describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { ManualClock } from '../src/domain/clock.js';
import { SequentialIdGenerator } from '../src/domain/ids.js';
import type { ActorContext } from '../src/domain/model.js';
import { createSimulationContainer, type OrionContainer } from '../src/container.js';
import { LUNA, ORBITA, ZONE } from '../src/fixtures/seed.js';

// Lunes 12 de octubre de 2026, 09:41 en Mazatlán (como los mockups).
const START = DateTime.fromISO('2026-10-12T09:41:00', { zone: ZONE }).toJSDate();
const local = (date: string, hhmm: string) => DateTime.fromISO(`${date}T${hhmm}:00`, { zone: ZONE }).toISO()!;
const TODAY = '2026-10-12';
const TOMORROW = '2026-10-13';

let c: OrionContainer;
let clock: ManualClock;
let owner: ActorContext;
let rid = 0;
const req = () => `req-${String(++rid).padStart(6, '0')}`;
const actor = (userId: string, businessId = ORBITA) => c.access.resolveActor(userId, businessId, 'test');

beforeEach(async () => {
  clock = new ManualClock(START);
  c = createSimulationContainer(clock, new SequentialIdGenerator());
  owner = await actor('u_alberto');
});

describe('Crear cita (L07) e idempotencia', () => {
  it('Doble toque / reintento tras timeout devuelve el mismo resultado y una sola cita', async () => {
    const body = { requestId: 'req-dup-0001', customerId: 'cus_008', serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '15:00') };
    const [a, b] = await Promise.all([c.appointments.create(owner, body), c.appointments.create(owner, body)]);
    expect(a.id).toBe(b.id);
    const again = await c.appointments.create(owner, body);
    expect(again.id).toBe(a.id);
    const agenda = await c.appointments.agenda(owner, { from: TOMORROW, professionalId: 'pro_luis' });
    expect(agenda.appointments.filter((x) => x.customer.id === 'cus_008')).toHaveLength(1);
    const op = await c.idempotency.operation('u_alberto', 'req-dup-0001');
    expect(op.status).toBe('SUCCEEDED');
  });

  it('Misma clave con otros datos se rechaza', async () => {
    const body = { requestId: 'req-key-0001', customerId: 'cus_008', serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '15:00') };
    await c.appointments.create(owner, body);
    await expect(c.appointments.create(owner, { ...body, startsAt: local(TOMORROW, '16:00') })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('Dos actores compiten por el mismo horario: una reserva, el resto conflicto controlado', async () => {
    const reception = await actor('u_rocio');
    const base = { serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '16:00') };
    const results = await Promise.allSettled([
      c.appointments.create(owner, { ...base, requestId: req(), customerId: 'cus_008' }),
      c.appointments.create(reception, { ...base, requestId: req(), customerId: 'cus_009' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: 'SLOT_UNAVAILABLE' });
  });

  it('El backend calcula fin, precio y estado; el cliente no los impone', async () => {
    const appt = await c.appointments.create(owner, { requestId: req(), customerId: 'cus_008', serviceId: 'svc_corte_peinado', professionalId: 'pro_ana', startsAt: local(TOMORROW, '10:00') });
    expect(appt).toMatchObject({ status: 'CONFIRMED', source: 'STAFF_APP', service: { durationMin: 45, price: { amountMinor: 45000, currency: 'MXN' } } });
    expect(appt.endsAt).toBe(local(TOMORROW, '10:45'));
  });

  it('"Cualquiera disponible" asigna dentro de la operación', async () => {
    const appt = await c.appointments.create(owner, { requestId: req(), customerId: 'cus_008', serviceId: 'svc_corte_clasico', professionalId: null, startsAt: local(TOMORROW, '15:00') });
    expect(['pro_ana', 'pro_luis']).toContain(appt.professional.id);
  });

  it('Un servicio archivado no admite reservas', async () => {
    await expect(
      c.appointments.create(owner, { requestId: req(), customerId: 'cus_008', serviceId: 'svc_keratina', professionalId: 'pro_ana', startsAt: local(TOMORROW, '10:00') }),
    ).rejects.toMatchObject({ code: 'POLICY_VIOLATION' });
  });
});

describe('Aprobación y vencimiento (L08)', () => {
  it('La solicitud de hoy se aprueba antes del vencimiento', async () => {
    const pending = (await c.appointments.agenda(owner, { from: TODAY, status: ['PENDING_APPROVAL'] })).appointments[0]!;
    expect(pending.allowedActions).toEqual(expect.arrayContaining(['approve', 'reject']));
    const ok = await c.appointments.transition(owner, pending.id, 'approve', { requestId: req(), expectedVersion: pending.version });
    expect(ok.status).toBe('CONFIRMED');
  });

  it('Aprobar después del vencimiento falla aunque el worker no haya corrido; el worker luego la vence', async () => {
    const pending = (await c.appointments.agenda(owner, { from: TODAY, status: ['PENDING_APPROVAL'] })).appointments[0]!;
    clock.set(new Date(pending.expiresAt!));
    await expect(c.appointments.transition(owner, pending.id, 'approve', { requestId: req(), expectedVersion: pending.version })).rejects.toMatchObject({
      code: 'APPOINTMENT_EXPIRED',
    });
    const expired = await c.appointments.expireAllDue();
    expect(expired).toBeGreaterThanOrEqual(1);
    const detail = await c.appointments.get(owner, pending.id);
    expect(detail.status).toBe('EXPIRED');
    expect(detail.history.at(-1)).toMatchObject({ toStatus: 'EXPIRED', actorName: 'Sistema' });
  });

  it('Aprobar al mismo tiempo que vencer: una sola transición válida', async () => {
    const pending = (await c.appointments.agenda(owner, { from: TODAY, status: ['PENDING_APPROVAL'] })).appointments[0]!;
    clock.set(new Date(new Date(pending.expiresAt!).getTime() - 1));
    const [approve, expire] = await Promise.allSettled([
      c.appointments.transition(owner, pending.id, 'approve', { requestId: req(), expectedVersion: pending.version }),
      c.appointments.expireAllDue(),
    ]);
    expect(approve.status).toBe('fulfilled');
    expect(expire.status).toBe('fulfilled');
    const detail = await c.appointments.get(owner, pending.id);
    expect(detail.status).toBe('CONFIRMED');
    expect(detail.history.map((h) => h.toStatus)).not.toContain('EXPIRED');
  });
});

describe('Reprogramar y cancelar (L09/L10)', () => {
  it('Reprogramar a horario ocupado conserva la cita original y no emite aviso de cambio', async () => {
    const mine = await c.appointments.create(owner, { requestId: req(), customerId: 'cus_008', serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '16:00') });
    await c.appointments.create(owner, { requestId: req(), customerId: 'cus_009', serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '17:00') });
    const eventsBefore = (await c.repos.outbox.all()).length;
    await expect(
      c.appointments.reschedule(owner, mine.id, { requestId: req(), expectedVersion: mine.version, startsAt: local(TOMORROW, '17:00') }),
    ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
    const after = await c.appointments.get(owner, mine.id);
    expect(after.startsAt).toBe(local(TOMORROW, '16:00'));
    expect(after.version).toBe(mine.version);
    expect((await c.repos.outbox.all()).length).toBe(eventsBefore);
  });

  it('Reprogramar a un horario libre conserva el ID, cambia la ocupación y emite un evento', async () => {
    const mine = await c.appointments.create(owner, { requestId: req(), customerId: 'cus_008', serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '16:00') });
    const moved = await c.appointments.reschedule(owner, mine.id, { requestId: req(), expectedVersion: mine.version, startsAt: local(TOMORROW, '17:30') });
    expect(moved.id).toBe(mine.id);
    expect(moved.startsAt).toBe(local(TOMORROW, '17:30'));
    // El horario anterior queda libre.
    const again = await c.appointments.create(owner, { requestId: req(), customerId: 'cus_009', serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '16:00') });
    expect(again.status).toBe('CONFIRMED');
    expect((await c.repos.outbox.all()).some((e) => e.eventType === 'appointment.rescheduled' && e.aggregateId === mine.id)).toBe(true);
  });

  it('Versión antigua: no se sobrescribe a ciegas', async () => {
    const mine = await c.appointments.create(owner, { requestId: req(), customerId: 'cus_008', serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '16:00') });
    await c.appointments.reschedule(owner, mine.id, { requestId: req(), expectedVersion: 1, startsAt: local(TOMORROW, '17:30') });
    await expect(c.appointments.transition(owner, mine.id, 'cancel', { requestId: req(), expectedVersion: 1 })).rejects.toMatchObject({ code: 'STALE_VERSION' });
  });

  it('Cancelar libera el horario', async () => {
    const mine = await c.appointments.create(owner, { requestId: req(), customerId: 'cus_008', serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '16:00') });
    await c.appointments.transition(owner, mine.id, 'cancel', { requestId: req(), expectedVersion: mine.version });
    const slots = await c.appointments.availability(owner, { serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', date: TOMORROW });
    expect(slots.slots.some((s) => s.localTime === '16:00')).toBe(true);
  });
});

describe('Permisos y aislamiento (sección 6 y 16)', () => {
  it('Profesional (Ana) pide la agenda de Luis → rechazo; su propia agenda sí', async () => {
    const ana = await actor('u_ana');
    await expect(c.appointments.agenda(ana, { from: TODAY, professionalId: 'pro_luis' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const own = await c.appointments.agenda(ana, { from: TODAY });
    expect(own.appointments.every((a) => a.professional.id === 'pro_ana')).toBe(true);
  });

  it('Profesional no puede abrir una cita ajena aunque conozca el ID', async () => {
    const ana = await actor('u_ana');
    const luisAppt = (await c.appointments.agenda(owner, { from: TODAY, professionalId: 'pro_luis' })).appointments[0]!;
    await expect(c.appointments.get(ana, luisAppt.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('Usuario manipula businessId → acceso denegado', async () => {
    await expect(actor('u_ana', LUNA)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('Clientes de otro negocio no se mezclan ni se pueden reservar', async () => {
    const lunaOwner = await actor('u_alberto', LUNA);
    const list = await c.customers.list(lunaOwner, {});
    expect(list.total).toBe(2);
    await expect(c.customers.get(lunaOwner, 'cus_001')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      c.appointments.create(owner, { requestId: req(), customerId: list.items[0]!.id, serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '15:00') }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('Recepción no tiene campañas ni canje por defecto', async () => {
    const rocio = await actor('u_rocio');
    expect(() => c.campaigns.list(rocio)).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
    await expect(c.loyalty.redeem(rocio, { requestId: req(), rewardId: 'rwd_mariana', appointmentId: null })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('Teléfono compartido: se sugiere posible duplicado pero no se fusiona', async () => {
    const mariana = await c.customers.get(owner, 'cus_001');
    const created = await c.customers.create(owner, { requestId: req(), name: 'Mariana Lopez', phone: mariana.phone! });
    expect(created.id).not.toBe('cus_001');
    expect(created.possibleDuplicates.map((d) => d.id)).toContain('cus_001');
  });
});

describe('Snapshots y fidelidad (L04/L15)', () => {
  it('Editar un servicio no altera el snapshot de citas existentes', async () => {
    const appt = await c.appointments.create(owner, { requestId: req(), customerId: 'cus_008', serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '15:00') });
    c.db.state.services.find((s) => s.id === 'svc_corte_clasico')!.priceMinor = 99900;
    const detail = await c.appointments.get(owner, appt.id);
    expect(detail.service.price.amountMinor).toBe(28000);
  });

  it('Evento de finalización duplicado produce un único sello', async () => {
    const mariana = (await c.appointments.agenda(owner, { from: TODAY, professionalId: 'pro_ana' })).appointments.find((a) => a.customer.id === 'cus_001')!;
    clock.set(new Date(mariana.startsAt));
    await c.appointments.transition(owner, mariana.id, 'complete', { requestId: req(), expectedVersion: mariana.version });
    const before = (await c.loyalty.membershipForCustomer(owner, 'cus_001'))!.stamps;
    const event = (await c.repos.outbox.all()).find((e) => e.eventType === 'appointment.completed' && e.aggregateId === mariana.id)!;
    await c.outbox.dispatchPending();
    // Reentrega con el mismo ID y con un ID distinto para la misma cita.
    await c.loyalty.consume(event);
    await c.loyalty.consume({ ...event, eventId: 'evt_replay' });
    const after = (await c.loyalty.membershipForCustomer(owner, 'cus_001'))!.stamps;
    expect(after).toBe(before + 1);
  });

  it('Canje simultáneo: un único canje autorizado', async () => {
    const results = await Promise.allSettled([
      c.loyalty.redeem(owner, { requestId: req(), rewardId: 'rwd_mariana', appointmentId: null }),
      c.loyalty.redeem(owner, { requestId: req(), rewardId: 'rwd_mariana', appointmentId: null }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
});

describe('Campañas (sección 27)', () => {
  it('La audiencia excluye a quien no dio consentimiento o se dio de baja', async () => {
    const p = await c.campaigns.previewAudience(owner, { mode: 'SEGMENT', segment: 'INACTIVE', inactiveDays: 60, excludeWithUpcoming: true });
    expect(p.matched).toBe(p.eligible + p.excluded.noConsent + p.excluded.optedOut);
    expect(p.matched).toBeGreaterThan(0);
  });

  it('No se puede programar con plantilla pendiente de aprobación', async () => {
    const draft = await c.campaigns.save(owner, null, {
      requestId: req(),
      name: 'Prueba',
      objective: 'WIN_BACK',
      audience: { mode: 'SEGMENT', segment: 'INACTIVE', inactiveDays: 60, excludeWithUpcoming: true },
      content: { templateId: 'tpl_volver', benefit: '20 %', validUntil: 'hasta el 31' },
      schedule: { mode: 'SCHEDULED', date: TOMORROW, time: '10:00' },
    });
    await expect(c.campaigns.confirm(owner, draft.id, req())).rejects.toMatchObject({ code: 'POLICY_VIOLATION' });
    expect(c.campaigns.get(owner, draft.id).status).toBe('DRAFT');
  });
});
