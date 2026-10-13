import { z } from 'zod';
import { Id, IsoDateTime, LocalDate } from './common.js';
import type { AgendaResponse, Appointment } from './appointments.js';
import type { SchedulesResponse } from './business.js';

/**
 * Widgets de inicio (plan en docs/widgets-plan.md). La app arma una instantánea con datos
 * que la API ya filtró por permisos y la deja en almacenamiento compartido; el widget nativo
 * solo la lee y la dibuja. El widget nunca llama a la API ni cambia el estado de una cita.
 */

/** Cuánto del cliente se muestra en la pantalla de inicio. Orden: de más a menos visible. */
export const WidgetPrivacy = z.enum(['FULL', 'INITIALS', 'HIDDEN']);
export type WidgetPrivacy = z.infer<typeof WidgetPrivacy>;

export const WIDGET_PRIVACY_LABELS: Record<WidgetPrivacy, string> = {
  FULL: 'Nombre completo',
  INITIALS: 'Solo iniciales',
  HIDDEN: 'Información oculta',
};

const PRIVACY_RANK: Record<WidgetPrivacy, number> = { FULL: 0, INITIALS: 1, HIDDEN: 2 };

/** El negocio fija el máximo visible; cada persona puede ocultar más, nunca mostrar más. */
export function effectiveWidgetPrivacy(businessMax: WidgetPrivacy, userPreference: WidgetPrivacy | null | undefined): WidgetPrivacy {
  if (!userPreference) return businessMax;
  return PRIVACY_RANK[userPreference] >= PRIVACY_RANK[businessMax] ? userPreference : businessMax;
}

/** Pose de Ori (imagen fija; los widgets no admiten animación continua). */
export const WidgetOriPose = z.enum(['wave', 'calendar', 'celebrate', 'sleep']);
export type WidgetOriPose = z.infer<typeof WidgetOriPose>;

export const WidgetAppointment = z.object({
  appointmentId: Id,
  startsAt: IsoDateTime,
  endsAt: IsoDateTime,
  /** Fecha local del negocio. */
  date: LocalDate,
  /** "10:00" en la zona del negocio. */
  timeLabel: z.string(),
  /** "Hoy", "Mañana" o "Jue 15". */
  dayLabel: z.string(),
  /** null cuando la privacidad es HIDDEN. */
  customerLabel: z.string().nullable(),
  serviceName: z.string().nullable(),
  professionalName: z.string().nullable(),
  colorKey: z.string(),
  status: z.enum(['CONFIRMED', 'PENDING_APPROVAL']),
  statusLabel: z.string(),
  deepLink: z.string(),
});
export type WidgetAppointment = z.infer<typeof WidgetAppointment>;

export const WidgetWeekDay = z.object({
  date: LocalDate,
  /** "Lun". */
  weekdayShort: z.string(),
  dayNumber: z.number().int(),
  /** Citas vigentes o atendidas ese día (sin canceladas, rechazadas ni vencidas). */
  count: z.number().int(),
  /** Negocio cerrado ese día y sin citas. */
  closed: z.boolean(),
  isToday: z.boolean(),
  /** "6 citas", "1 cita", "Sin citas" o "Cerrado". */
  countLabel: z.string(),
  deepLink: z.string(),
});
export type WidgetWeekDay = z.infer<typeof WidgetWeekDay>;

export const WIDGET_SNAPSHOT_VERSION = 1;
/** Pasado este tiempo el widget pide abrir la app para actualizar. */
export const WIDGET_STALE_AFTER_MIN = 120;
const MAX_UPCOMING = 6;

export const WidgetSnapshot = z.object({
  schemaVersion: z.literal(WIDGET_SNAPSHOT_VERSION),
  generatedAt: IsoDateTime,
  /** "09:40": se muestra como "Actualizado 09:40". */
  generatedAtLabel: z.string(),
  businessId: Id,
  businessName: z.string(),
  timezone: z.string(),
  privacy: WidgetPrivacy,
  today: LocalDate,
  /** scheduled = total del día (vigentes + atendidas), como el anillo de Inicio. */
  day: z.object({ scheduled: z.number().int(), completed: z.number().int(), pending: z.number().int() }),
  /** Solicitud por aprobar que vence primero. */
  nextPendingExpiresAt: IsoDateTime.nullable(),
  /** Próximas citas desde ahora, en orden; la primera es "Próxima cita". */
  upcoming: z.array(WidgetAppointment).max(MAX_UPCOMING),
  week: z.object({
    from: LocalDate,
    to: LocalDate,
    /** "12–18 de octubre". */
    rangeLabel: z.string(),
    days: z.array(WidgetWeekDay).length(7),
  }),
  oriPose: WidgetOriPose,
  /** Texto para el estado vacío del widget de agenda. */
  emptyMessage: z.string(),
});
export type WidgetSnapshot = z.infer<typeof WidgetSnapshot>;

// ── Construcción (función pura; la usa la app y la prueban las pruebas) ──

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DEEP_LINK = 'orionbusiness://';

export interface BuildWidgetSnapshotInput {
  now: Date;
  business: { id: string; name: string; timezone: string };
  privacy: WidgetPrivacy;
  /** Fecha local del negocio (la de Inicio). */
  today: string;
  /** Agenda de lunes a domingo de la semana de `today`, ya filtrada por permisos. */
  week: Pick<AgendaResponse, 'appointments' | 'days'>;
  /** null si el usuario no puede ver horarios: entonces ningún día se marca "Cerrado". */
  schedules: Pick<SchedulesResponse, 'business' | 'exceptions'> | null;
}

/** "Mariana López" → "M. L."; "Ana" → "A.". */
export function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Cliente';
  const picked = parts.length === 1 ? [parts[0]!] : [parts[0]!, parts[parts.length - 1]!];
  return picked.map((p) => `${p.charAt(0).toLocaleUpperCase('es-MX')}.`).join(' ');
}

function parseDate(d: string): Date {
  return new Date(`${d}T00:00:00Z`);
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: string, n: number): string {
  const x = parseDate(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fmtDate(x);
}

/** 0 = lunes … 6 = domingo. */
function weekdayIndex(d: string): number {
  return (parseDate(d).getUTCDay() + 6) % 7;
}

/** Lunes de la semana de `d`. */
export function weekStart(d: string): string {
  return addDays(d, -weekdayIndex(d));
}

function localParts(iso: string, timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

function rangeLabel(from: string, to: string): string {
  const a = parseDate(from);
  const b = parseDate(to);
  const ma = MONTHS[a.getUTCMonth()]!;
  const mb = MONTHS[b.getUTCMonth()]!;
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${b.getUTCDate()} de ${mb}`;
  return `${a.getUTCDate()} ${ma.slice(0, 3)} – ${b.getUTCDate()} ${mb.slice(0, 3)}`;
}

function dayLabel(date: string, today: string): string {
  if (date === today) return 'Hoy';
  if (date === addDays(today, 1)) return 'Mañana';
  return `${WEEKDAYS[weekdayIndex(date)]} ${parseDate(date).getUTCDate()}`;
}

function countLabel(count: number, closed: boolean): string {
  if (closed) return 'Cerrado';
  if (count === 0) return 'Sin citas';
  return count === 1 ? '1 cita' : `${count} citas`;
}

function isBusinessClosed(date: string, schedules: BuildWidgetSnapshotInput['schedules']): boolean {
  if (!schedules) return false;
  const exception = schedules.exceptions.find((e) => e.professionalId === null && e.date === date);
  if (exception) return exception.closed || exception.intervals.length === 0;
  const weekday = weekdayIndex(date) + 1;
  const day = schedules.business.days.find((d) => d.weekday === weekday);
  return !day || day.intervals.length === 0;
}

function toWidgetAppointment(a: Appointment, privacy: WidgetPrivacy, today: string, timezone: string): WidgetAppointment {
  const { date, time } = localParts(a.startsAt, timezone);
  const hidden = privacy === 'HIDDEN';
  return {
    appointmentId: a.id,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    date,
    timeLabel: time,
    dayLabel: dayLabel(date, today),
    customerLabel: hidden ? null : privacy === 'FULL' ? a.customer.name : customerInitials(a.customer.name),
    serviceName: hidden ? null : a.service.name,
    professionalName: hidden ? null : a.professional.name,
    colorKey: a.professional.colorKey,
    status: a.status === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : 'CONFIRMED',
    statusLabel: a.status === 'PENDING_APPROVAL' ? 'Por aprobar' : 'Confirmada',
    deepLink: `${DEEP_LINK}cita/${a.id}`,
  };
}

export function buildWidgetSnapshot(input: BuildWidgetSnapshotInput): WidgetSnapshot {
  const { now, business, privacy, today, week, schedules } = input;
  const tz = business.timezone;
  const from = weekStart(today);
  const to = addDays(from, 6);
  const nowMs = now.getTime();

  const live = week.appointments.filter((a) => a.status === 'CONFIRMED' || a.status === 'PENDING_APPROVAL');
  const upcoming = live
    .filter((a) => Date.parse(a.endsAt) > nowMs && !(a.status === 'PENDING_APPROVAL' && a.expiresAt && Date.parse(a.expiresAt) <= nowMs))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, MAX_UPCOMING)
    .map((a) => toWidgetAppointment(a, privacy, today, tz));

  const todayAppointments = week.appointments.filter((a) => localParts(a.startsAt, tz).date === today);
  const completed = todayAppointments.filter((a) => a.status === 'COMPLETED').length;
  const pending = todayAppointments.filter((a) => a.status === 'PENDING_APPROVAL').length;
  const scheduled = todayAppointments.filter((a) => a.status === 'CONFIRMED' || a.status === 'PENDING_APPROVAL').length + completed;

  const nextPending = live
    .filter((a) => a.status === 'PENDING_APPROVAL' && a.expiresAt && Date.parse(a.expiresAt) > nowMs)
    .map((a) => a.expiresAt!)
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0];

  const days: WidgetWeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(from, i);
    const summary = week.days.find((d) => d.date === date);
    const count = summary ? summary.confirmed + summary.pending + summary.completed : 0;
    const closed = count === 0 && isBusinessClosed(date, schedules);
    return {
      date,
      weekdayShort: WEEKDAYS[i]!,
      dayNumber: parseDate(date).getUTCDate(),
      count,
      closed,
      isToday: date === today,
      countLabel: countLabel(count, closed),
      deepLink: `${DEEP_LINK}agenda?fecha=${date}`,
    };
  });

  const remainingToday = upcoming.filter((a) => a.date === today).length;
  const dayComplete = scheduled > 0 && remainingToday === 0 && completed > 0;
  const oriPose: WidgetOriPose = dayComplete ? 'celebrate' : scheduled === 0 ? 'sleep' : remainingToday > 0 ? 'wave' : 'calendar';
  const emptyMessage = dayComplete
    ? '¡Día completo! Todas las citas atendidas.'
    : days.find((d) => d.isToday)?.closed
      ? 'Hoy el negocio está cerrado.'
      : scheduled === 0
        ? 'Día libre: hoy no hay citas.'
        : 'Sin más citas por hoy.';

  return {
    schemaVersion: WIDGET_SNAPSHOT_VERSION,
    generatedAt: now.toISOString(),
    generatedAtLabel: localParts(now.toISOString(), tz).time,
    businessId: business.id,
    businessName: business.name,
    timezone: tz,
    privacy,
    today,
    day: { scheduled, completed, pending },
    nextPendingExpiresAt: nextPending ?? null,
    upcoming,
    week: { from, to, rangeLabel: rangeLabel(from, to), days },
    oriPose,
    emptyMessage,
  };
}

/** Para el widget: si la instantánea es de otra fecha o muy vieja, se pide abrir la app. */
export function isWidgetSnapshotStale(snapshot: Pick<WidgetSnapshot, 'generatedAt'>, now: Date): boolean {
  return now.getTime() - Date.parse(snapshot.generatedAt) > WIDGET_STALE_AFTER_MIN * 60_000;
}
