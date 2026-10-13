import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSimulationContainer, type OrionContainer } from '../src/container.js';
import { ManualClock } from '../src/domain/clock.js';
import { SequentialIdGenerator } from '../src/domain/ids.js';
import type { ActorContext } from '../src/domain/model.js';
import { ORBITA, ZONE } from '../src/fixtures/seed.js';

const START = DateTime.fromISO('2026-10-12T09:41:00', { zone: ZONE }).toJSDate(); // lunes
const local = (date: string, hhmm: string) => DateTime.fromISO(`${date}T${hhmm}:00`, { zone: ZONE }).toISO()!;
const TOMORROW = '2026-10-13'; // martes
const WEEK: Array<{ weekday: number; intervals: Array<{ start: string; end: string }> }> = [1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  intervals: [{ start: '09:00', end: '13:30' }, { start: '14:30', end: '19:00' }],
}));

let c: OrionContainer;
let clock: ManualClock;
let owner: ActorContext;
let rid = 0;
const req = () => `cfg-${String(++rid).padStart(6, '0')}`;

beforeEach(async () => {
  clock = new ManualClock(START);
  c = createSimulationContainer(clock, new SequentialIdGenerator());
  owner = await c.access.resolveActor('u_alberto', ORBITA, 'test');
});

describe('Servicios (L04)', () => {
  it('Cambiar el precio aplica a nuevas reservas; las existentes conservan su snapshot', async () => {
    const before = await c.appointments.create(owner, { requestId: req(), customerId: 'cus_008', serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '15:00') });
    const svc = (await c.config.services(owner)).find((s) => s.id === 'svc_corte_clasico')!;
    await c.config.saveService(owner, svc.id, { requestId: req(), name: svc.name, durationMin: 30, bufferBeforeMin: 0, bufferAfterMin: 0, priceMinor: 32000, professionalIds: svc.professionalIds });
    const after = await c.appointments.create(owner, { requestId: req(), customerId: 'cus_009', serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '16:00') });
    expect((await c.appointments.get(owner, before.id)).service.price.amountMinor).toBe(28000);
    expect(after.service.price.amountMinor).toBe(32000);
  });

  it('Crear un servicio, asignarlo y archivarlo: deja de ofrecerse pero conserva el historial', async () => {
    const created = await c.config.saveService(owner, null, { requestId: req(), name: 'Peinado de evento', durationMin: 60, bufferBeforeMin: 0, bufferAfterMin: 10, priceMinor: 70000, professionalIds: ['pro_ana'] });
    const slots = await c.appointments.availability(owner, { serviceId: created.id, professionalId: 'pro_ana', date: TOMORROW });
    expect(slots.slots.length).toBeGreaterThan(0);
    const appt = await c.appointments.create(owner, { requestId: req(), customerId: 'cus_008', serviceId: created.id, professionalId: 'pro_ana', startsAt: slots.slots[0]!.startsAt });
    await c.config.saveService(owner, created.id, { requestId: req(), name: created.name, durationMin: 60, bufferBeforeMin: 0, bufferAfterMin: 10, priceMinor: 70000, professionalIds: ['pro_ana'], active: false });
    await expect(c.appointments.availability(owner, { serviceId: created.id, date: TOMORROW })).rejects.toMatchObject({ code: 'POLICY_VIOLATION' });
    expect((await c.appointments.get(owner, appt.id)).service.name).toBe('Peinado de evento');
  });

  it('Validaciones: duración positiva y profesionales del mismo negocio', async () => {
    await expect(c.config.saveService(owner, null, { requestId: req(), name: 'X', durationMin: 0, bufferBeforeMin: 0, bufferAfterMin: 0, priceMinor: 0, professionalIds: [] })).rejects.toThrow();
    await expect(
      c.config.saveService(owner, null, { requestId: req(), name: 'Consulta', durationMin: 30, bufferBeforeMin: 0, bufferAfterMin: 0, priceMinor: 100, professionalIds: ['pro_elena'] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('Recepción no puede editar el catálogo', async () => {
    const rocio = await c.access.resolveActor('u_rocio', ORBITA, 'test');
    await expect(c.config.saveService(rocio, null, { requestId: req(), name: 'Nuevo', durationMin: 30, bufferBeforeMin: 0, bufferAfterMin: 0, priceMinor: 100, professionalIds: [] })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('Equipo (L03)', () => {
  it('Alta de profesional sin usuario de acceso, con jornada inicial del negocio', async () => {
    const pro = await c.config.saveProfessional(owner, null, { requestId: req(), name: 'Marta', colorKey: 'sky', serviceIds: ['svc_manicura'] });
    expect(pro).toMatchObject({ hasUserAccess: false, active: true, serviceIds: ['svc_manicura'] });
    const slots = await c.appointments.availability(owner, { serviceId: 'svc_manicura', professionalId: pro.id, date: TOMORROW });
    expect(slots.slots.length).toBeGreaterThan(0);
  });

  it('No se desactiva con citas futuras: se listan para resolverlas; después sí', async () => {
    await expect(c.config.setProfessionalActive(owner, 'pro_sofia', false, req())).rejects.toMatchObject({ code: 'POLICY_VIOLATION', details: { conflicts: expect.any(Array) } });
    const pending = await c.config.futureAppointments(owner, 'pro_sofia');
    expect(pending.length).toBeGreaterThan(0);
    for (const p of pending) {
      const a = await c.appointments.get(owner, p.appointmentId);
      await c.appointments.transition(owner, a.id, 'cancel', { requestId: req(), expectedVersion: a.version, reason: 'Baja de profesional' });
    }
    const off = await c.config.setProfessionalActive(owner, 'pro_sofia', false, req());
    expect(off.active).toBe(false);
    const slots = await c.appointments.availability(owner, { serviceId: 'svc_manicura', date: TOMORROW });
    expect(slots.slots.every((s) => !s.professionalIds.includes('pro_sofia'))).toBe(true);
  });

  it('Administración (sin team.manage) no da de alta profesionales', async () => {
    const carmen = await c.access.resolveActor('u_carmen', ORBITA, 'test');
    await expect(c.config.saveProfessional(carmen, null, { requestId: req(), name: 'Nadie', colorKey: 'sky', serviceIds: [] })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('Horarios y excepciones (L05)', () => {
  it('Acortar la jornada con citas existentes devuelve conflictos y no aplica nada', async () => {
    await c.appointments.create(owner, { requestId: req(), customerId: 'cus_008', serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '18:00') });
    const shorter = WEEK.map((d) => ({ ...d, intervals: [{ start: '09:00', end: '13:30' }] }));
    const preview = await c.config.setWeeklyHours(owner, { requestId: req(), professionalId: 'pro_luis', days: shorter, dryRun: true });
    expect(preview.applied).toBe(false);
    expect(preview.conflicts.some((x) => x.startsAt === local(TOMORROW, '18:00'))).toBe(true);
    await expect(c.config.setWeeklyHours(owner, { requestId: req(), professionalId: 'pro_luis', days: shorter })).rejects.toMatchObject({ code: 'POLICY_VIOLATION' });
    // La cita sigue en pie y el horario no cambió.
    const slots = await c.appointments.availability(owner, { serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', date: TOMORROW });
    expect(slots.slots.some((s) => s.localTime === '17:00')).toBe(true);
  });

  it('Sin conflictos se aplica y la disponibilidad lo refleja', async () => {
    const days = WEEK.map((d) => (d.weekday === 3 ? { weekday: 3, intervals: [] } : d)); // miércoles libre
    const r = await c.config.setWeeklyHours(owner, { requestId: req(), professionalId: 'pro_luis', days });
    expect(r).toEqual({ applied: true, conflicts: [] });
    const wed = await c.appointments.availability(owner, { serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', date: '2026-10-14' });
    expect(wed.slots).toHaveLength(0);
  });

  it('Rechaza intervalos traslapados o invertidos', async () => {
    const bad = [{ weekday: 1, intervals: [{ start: '09:00', end: '12:00' }, { start: '11:00', end: '14:00' }] }];
    await expect(c.config.setWeeklyHours(owner, { requestId: req(), professionalId: 'pro_luis', days: bad })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(c.config.setWeeklyHours(owner, { requestId: req(), professionalId: 'pro_luis', days: [{ weekday: 1, intervals: [{ start: '15:00', end: '10:00' }] }] })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('Cerrar un día con citas exige resolverlas; un día sin citas se cierra', async () => {
    await expect(c.config.saveException(owner, { requestId: req(), professionalId: null, date: TOMORROW, closed: true, intervals: [], reason: 'Feriado' })).rejects.toMatchObject({ code: 'POLICY_VIOLATION' });
    const free = '2026-10-20';
    const r = await c.config.saveException(owner, { requestId: req(), professionalId: null, date: free, closed: true, intervals: [], reason: 'Inventario' });
    expect(r.applied).toBe(true);
    const slots = await c.appointments.availability(owner, { serviceId: 'svc_corte_clasico', date: free });
    expect(slots.slots).toHaveLength(0);
    expect(slots.closedReason).toBe('Inventario');
    const sched = await c.business.schedules(owner);
    const exc = sched.exceptions.find((e) => e.date === free)!;
    await c.config.deleteException(owner, exc.id, req());
    expect((await c.appointments.availability(owner, { serviceId: 'svc_corte_clasico', date: free })).slots.length).toBeGreaterThan(0);
  });
});

describe('Bloqueos', () => {
  it('No se puede bloquear encima de una cita; un bloqueo libre impide reservar y aparece en la agenda', async () => {
    await expect(c.config.createBlock(owner, { requestId: req(), professionalId: 'pro_luis', startsAt: local('2026-10-12', '10:15'), endsAt: local('2026-10-12', '10:45') })).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
    const blk = await c.config.createBlock(owner, { requestId: req(), professionalId: 'pro_luis', startsAt: local(TOMORROW, '10:30'), endsAt: local(TOMORROW, '11:30'), reason: 'Trámite' });
    await expect(
      c.appointments.create(owner, { requestId: req(), customerId: 'cus_008', serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '11:00') }),
    ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
    const agenda = await c.appointments.agenda(owner, { from: TOMORROW });
    expect(agenda.blocks.map((b) => b.id)).toContain(blk.id);
    await c.config.removeBlock(owner, blk.id, req());
    expect((await c.appointments.agenda(owner, { from: TOMORROW })).blocks).toHaveLength(0);
  });
});

describe('Notificaciones (UI18)', () => {
  it('Muestra solicitudes y cancelaciones de WhatsApp, no las acciones propias, y marca como leídas', async () => {
    const inbox = await c.notifications.list(owner);
    expect(inbox.items.some((i) => i.type === 'REQUEST_RECEIVED')).toBe(true);
    expect(inbox.items.some((i) => i.type === 'APPOINTMENT_CANCELLED')).toBe(true);
    const mine = await c.appointments.create(owner, { requestId: req(), customerId: 'cus_008', serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '15:00') });
    const again = await c.notifications.list(owner);
    expect(again.items.some((i) => i.appointmentId === mine.id)).toBe(false);
    const read = await c.notifications.markRead(owner, { all: true });
    expect(read.unreadCount).toBe(0);
  });

  it('Un profesional solo recibe avisos de sus propias citas', async () => {
    const ana = await c.access.resolveActor('u_ana', ORBITA, 'test');
    const inbox = await c.notifications.list(ana);
    for (const i of inbox.items) {
      const a = await c.appointments.get(owner, i.appointmentId!);
      expect(a.professional.id).toBe('pro_ana');
    }
  });

  it('Una solicitud vencida genera aviso', async () => {
    clock.advanceMinutes(60);
    await c.appointments.expireAllDue();
    const inbox = await c.notifications.list(owner);
    expect(inbox.items.some((i) => i.type === 'REQUEST_EXPIRED')).toBe(true);
  });
});

describe('Campañas (UI24)', () => {
  it('Pausar, reanudar y cancelar con historial; no se reanuda una cancelada', async () => {
    const paused = await c.campaigns.changeStatus(owner, 'cmp_corte', 'pause', req());
    expect(paused.status).toBe('PAUSED');
    expect((await c.campaigns.changeStatus(owner, 'cmp_corte', 'resume', req())).status).toBe('SCHEDULED');
    const cancelled = await c.campaigns.changeStatus(owner, 'cmp_corte', 'cancel', req());
    expect(cancelled.timeline.at(-1)!.label).toMatch(/Cancelada/);
    await expect(c.campaigns.changeStatus(owner, 'cmp_corte', 'resume', req())).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('Selección manual: la vista previa excluye a quien no dio consentimiento', async () => {
    const list = await c.customers.list(owner, { limit: 100 });
    const granted = list.items.find((x) => x.promotionalConsent === 'GRANTED')!;
    const notGranted = list.items.find((x) => x.promotionalConsent !== 'GRANTED')!;
    const p = await c.campaigns.previewAudience(owner, { mode: 'MANUAL', customerIds: [granted.id, notGranted.id] });
    expect(p).toMatchObject({ matched: 2, eligible: 1 });
  });
});

describe('Reglas de reserva versionadas (L17)', () => {
  const base = {
    confirmationMode: 'MANUAL' as const,
    slotGranularityMin: 15,
    minLeadMin: 60,
    maxHorizonDays: 60,
    approvalWindowMin: 30,
    customerCancelUntilMin: 120,
    customerRescheduleUntilMin: 120,
    noShowGraceMin: 15,
  };

  it('La vista previa lista cambios y advertencias sin aplicar nada', async () => {
    const r = await c.settings.updatePolicy(owner, { requestId: req(), ...base, noShowGraceMin: 30, dryRun: true });
    expect(r.applied).toBe(false);
    expect(r.changes).toEqual([expect.objectContaining({ field: 'noShowGraceMin', from: '15 min', to: '30 min' })]);
    // minLead (1 h) < cancelación (2 h): advertencia de la sección 24.
    expect(r.warnings.some((w) => /no podrá cancelar/.test(w))).toBe(true);
    expect((await c.business.profile(owner)).policy.version).toBe(1);
  });

  it('Las citas existentes conservan la política con la que se reservaron', async () => {
    const appt = await c.appointments.create(owner, { requestId: req(), customerId: 'cus_008', serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '15:00') });
    // Nueva versión con margen de ausencia de 60 min.
    const r = await c.settings.updatePolicy(owner, { requestId: req(), ...base, noShowGraceMin: 60 });
    expect(r).toMatchObject({ applied: true, policy: { version: 2 } });
    expect(r.appointmentsKeepingPreviousVersion).toBeGreaterThan(0);
    // La cita (v1) admite "No asistió" a los 15 min; una cita nueva (v2), hasta los 60.
    clock.set(new Date(new Date(appt.startsAt).getTime() + 20 * 60_000));
    const old = await c.appointments.get(owner, appt.id);
    expect(old.policyVersion).toBe(1);
    expect(old.allowedActions).toContain('no-show');
    const history = await c.settings.policyHistory(owner);
    expect(history.map((h) => h.version)).toEqual([2, 1]);
  });

  it('Sin cambios no crea versión; recepción no puede cambiar reglas', async () => {
    await expect(c.settings.updatePolicy(owner, { requestId: req(), ...base })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const rocio = await c.access.resolveActor('u_rocio', ORBITA, 'test');
    await expect(c.settings.updatePolicy(rocio, { requestId: req(), ...base, noShowGraceMin: 30 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('Perfil: cambiar categoría cambia el vocabulario; pausar reservas externas no suspende', async () => {
    const p = await c.settings.updateProfile(owner, { requestId: req(), name: 'Estudio Órbita Centro', category: 'CLINIC', acceptingExternalBookings: false });
    expect(p).toMatchObject({ name: 'Estudio Órbita Centro', status: 'ACTIVE', acceptingExternalBookings: false });
    const me = await c.access.me('u_alberto');
    expect(me.memberships.find((m) => m.businessId === ORBITA)!.vocabulary.customerPlural).toBe('Pacientes');
    // La agenda interna sigue operando.
    const appt = await c.appointments.create(owner, { requestId: req(), customerId: 'cus_008', serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: local(TOMORROW, '15:00') });
    expect(appt.status).toBe('CONFIRMED');
  });
});
