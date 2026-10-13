import { describe, expect, it } from 'vitest';
import type { Appointment } from '../src/appointments.js';
import {
  buildWidgetSnapshot,
  customerInitials,
  effectiveWidgetPrivacy,
  isWidgetSnapshotStale,
  weekStart,
  WidgetSnapshot,
  type BuildWidgetSnapshotInput,
} from '../src/widgets.js';

const TZ = 'America/Mazatlan'; // UTC-7 todo el año

let seq = 0;
function apt(startLocal: string, status: Appointment['status'], over: Partial<Appointment> = {}): Appointment {
  const startsAt = `${startLocal}:00.000-07:00`;
  const endsAt = new Date(Date.parse(startsAt) + 30 * 60_000).toISOString();
  return {
    id: `apt_${++seq}`,
    businessId: 'biz_1',
    status,
    source: 'STAFF_APP',
    startsAt,
    endsAt,
    timezone: TZ,
    version: 1,
    expiresAt: null,
    customer: { id: 'cus_1', name: 'Mariana López Ruiz', firstVisit: false },
    professional: { id: 'pro_1', name: 'Ana', initials: 'A', colorKey: 'violet' },
    service: { id: 'srv_1', name: 'Corte y peinado', durationMin: 30, price: { amountMinor: 25000, currency: 'MXN' } },
    policyVersion: 1,
    allowedActions: [],
    customerNotice: 'NOT_APPLICABLE',
    createdAt: '2026-10-01T10:00:00.000Z',
    ...over,
  } as Appointment;
}

function daySummaries(apts: Appointment[]) {
  const map = new Map<string, { date: string; confirmed: number; pending: number; completed: number; cancelled: number; noShow: number }>();
  for (const a of apts) {
    const date = a.startsAt.slice(0, 10);
    const d = map.get(date) ?? { date, confirmed: 0, pending: 0, completed: 0, cancelled: 0, noShow: 0 };
    if (a.status === 'CONFIRMED') d.confirmed++;
    if (a.status === 'PENDING_APPROVAL') d.pending++;
    if (a.status === 'COMPLETED') d.completed++;
    if (a.status === 'CANCELLED') d.cancelled++;
    map.set(date, d);
  }
  return [...map.values()];
}

const schedules: BuildWidgetSnapshotInput['schedules'] = {
  business: {
    professionalId: null,
    days: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, intervals: [{ start: '09:00', end: '19:00' }] })),
  },
  exceptions: [{ id: 'exc_1', professionalId: null, date: '2026-10-16', closed: true, intervals: [], reason: 'Inventario' }],
};

function input(apts: Appointment[], over: Partial<BuildWidgetSnapshotInput> = {}): BuildWidgetSnapshotInput {
  return {
    now: new Date('2026-10-14T09:40:00.000-07:00'),
    business: { id: 'biz_1', name: 'Estudio Órbita', timezone: TZ },
    privacy: 'INITIALS',
    today: '2026-10-14',
    week: { appointments: apts, days: daySummaries(apts) },
    schedules,
    ...over,
  };
}

describe('Widgets: instantánea (W1)', () => {
  const week = [
    apt('2026-10-12T10:00', 'COMPLETED'),
    apt('2026-10-14T09:00', 'COMPLETED'),
    apt('2026-10-14T10:00', 'CONFIRMED'),
    apt('2026-10-14T10:30', 'PENDING_APPROVAL', { expiresAt: '2026-10-14T09:59:00.000-07:00' }),
    apt('2026-10-14T11:00', 'CANCELLED'),
    apt('2026-10-15T12:00', 'CONFIRMED'),
  ];

  it('cumple el contrato y calcula la semana de lunes a domingo', () => {
    const s = buildWidgetSnapshot(input(week));
    expect(() => WidgetSnapshot.parse(s)).not.toThrow();
    expect(s.week.from).toBe('2026-10-12');
    expect(s.week.to).toBe('2026-10-18');
    expect(s.week.rangeLabel).toBe('12–18 de octubre');
    expect(s.week.days.map((d) => d.weekdayShort)).toEqual(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']);
    expect(s.generatedAtLabel).toBe('09:40');
  });

  it('cuenta citas por día sin canceladas y marca cerrados solo sin citas', () => {
    const s = buildWidgetSnapshot(input(week));
    const byDate = Object.fromEntries(s.week.days.map((d) => [d.date, d.countLabel]));
    expect(byDate['2026-10-12']).toBe('1 cita');
    expect(byDate['2026-10-14']).toBe('3 citas'); // completada + confirmada + por aprobar; la cancelada no cuenta
    expect(byDate['2026-10-13']).toBe('Sin citas');
    expect(byDate['2026-10-16']).toBe('Cerrado'); // excepción del negocio
    expect(byDate['2026-10-18']).toBe('Cerrado'); // domingo sin jornada
    expect(s.week.days.find((d) => d.isToday)?.date).toBe('2026-10-14');
    expect(s.week.days[0]!.deepLink).toBe('orionbusiness://agenda?fecha=2026-10-12');
  });

  it('próximas citas: futuras, vigentes, en orden y con hora local del negocio', () => {
    const s = buildWidgetSnapshot(input(week));
    expect(s.upcoming.map((a) => a.timeLabel)).toEqual(['10:00', '10:30', '12:00']);
    expect(s.upcoming[0]!.dayLabel).toBe('Hoy');
    expect(s.upcoming[2]!.dayLabel).toBe('Mañana');
    expect(s.upcoming[1]!.statusLabel).toBe('Por aprobar');
    expect(s.upcoming[0]!.deepLink).toMatch(/^orionbusiness:\/\/cita\/apt_/);
    expect(s.day).toEqual({ scheduled: 3, completed: 1, pending: 1 });
    expect(s.nextPendingExpiresAt).toBe('2026-10-14T09:59:00.000-07:00');
    expect(s.oriPose).toBe('wave');
  });

  it('una solicitud ya vencida no aparece como próxima', () => {
    const s = buildWidgetSnapshot(input(week, { now: new Date('2026-10-14T10:05:00.000-07:00') }));
    expect(s.upcoming.map((a) => a.timeLabel)).toEqual(['10:00', '12:00']);
    expect(s.nextPendingExpiresAt).toBeNull();
  });

  it('privacidad: completo, iniciales u oculto', () => {
    expect(buildWidgetSnapshot(input(week, { privacy: 'FULL' })).upcoming[0]!.customerLabel).toBe('Mariana López Ruiz');
    expect(buildWidgetSnapshot(input(week, { privacy: 'INITIALS' })).upcoming[0]!.customerLabel).toBe('M. R.');
    const hidden = buildWidgetSnapshot(input(week, { privacy: 'HIDDEN' })).upcoming[0]!;
    expect(hidden.customerLabel).toBeNull();
    expect(hidden.serviceName).toBeNull();
    expect(hidden.professionalName).toBeNull();
    expect(hidden.timeLabel).toBe('10:00');
  });

  it('el negocio fija el máximo y cada persona solo puede ocultar más', () => {
    expect(effectiveWidgetPrivacy('INITIALS', 'FULL')).toBe('INITIALS');
    expect(effectiveWidgetPrivacy('INITIALS', 'HIDDEN')).toBe('HIDDEN');
    expect(effectiveWidgetPrivacy('FULL', null)).toBe('FULL');
    expect(effectiveWidgetPrivacy('HIDDEN', 'FULL')).toBe('HIDDEN');
  });

  it('iniciales con uno o varios nombres', () => {
    expect(customerInitials('Mariana López')).toBe('M. L.');
    expect(customerInitials('  ana ')).toBe('A.');
    expect(customerInitials('')).toBe('Cliente');
  });

  it('estados: día completo celebra, día sin citas duerme', () => {
    const done = [apt('2026-10-14T08:00', 'COMPLETED'), apt('2026-10-14T08:30', 'COMPLETED')];
    const s = buildWidgetSnapshot(input(done));
    expect(s.oriPose).toBe('celebrate');
    expect(s.emptyMessage).toMatch(/Día completo/);
    const empty = buildWidgetSnapshot(input([]));
    expect(empty.oriPose).toBe('sleep');
    expect(empty.upcoming).toEqual([]);
    expect(empty.emptyMessage).toBe('Día libre: hoy no hay citas.');
  });

  it('sin permiso de horarios no inventa días cerrados', () => {
    const s = buildWidgetSnapshot(input([], { schedules: null }));
    expect(s.week.days.every((d) => !d.closed)).toBe(true);
  });

  it('semana que cruza de mes y datos viejos', () => {
    expect(weekStart('2026-11-01')).toBe('2026-10-26');
    const s = buildWidgetSnapshot(input([], { today: '2026-10-29', now: new Date('2026-10-29T09:00:00.000-07:00') }));
    expect(s.week.rangeLabel).toBe('26 oct – 1 nov');
    expect(isWidgetSnapshotStale(s, new Date('2026-10-29T10:59:00.000-07:00'))).toBe(false);
    expect(isWidgetSnapshotStale(s, new Date('2026-10-29T11:01:00.000-07:00'))).toBe(true);
  });
});
