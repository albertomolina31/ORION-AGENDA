import type { BookingPolicy } from '@orion/contracts';
import { DomainError } from './errors.js';
import { type Interval, MINUTE, contains, intersectAll, overlaps } from './interval.js';
import { isoWeekday, localDateTime, localIntervals } from './local-time.js';
import type { CalendarOccupancy, Professional, ScheduleException, Service, WeeklyHours } from './model.js';

export interface AvailabilityInput {
  date: string;
  zone: string;
  now: Date;
  policy: BookingPolicy;
  service: Service;
  /** Candidatos ya filtrados por negocio; aquí se comprueban activo/habilitado. */
  professionals: Professional[];
  enabledProfessionalIds: ReadonlySet<string>;
  businessHours: WeeklyHours;
  professionalHours: WeeklyHours[];
  exceptions: ScheduleException[];
  occupancies: CalendarOccupancy[];
  excludeAppointmentId?: string;
}

export interface CandidateSlot {
  start: number;
  end: number;
  professionalId: string;
}

export interface DayResult {
  slots: CandidateSlot[];
  closedReason: string | null;
}

/**
 * Intervalos de trabajo de un profesional en una fecha local.
 * Precedencia (L05): cierre del negocio → excepción de apertura del negocio → jornada
 * habitual; intersectar con excepción/jornada del profesional.
 */
export function workingIntervals(
  input: Pick<AvailabilityInput, 'date' | 'zone' | 'businessHours' | 'professionalHours' | 'exceptions'>,
  professionalId: string,
): { intervals: Interval[]; closedReason: string | null } {
  const { date, zone } = input;
  const weekday = isoWeekday(date, zone);
  const bizEx = input.exceptions.find((e) => e.professionalId === null && e.date === date);
  if (bizEx?.closed) return { intervals: [], closedReason: bizEx.reason ?? 'Negocio cerrado' };
  const bizRanges = bizEx ? bizEx.intervals : (input.businessHours.days[weekday] ?? []);
  if (bizRanges.length === 0) return { intervals: [], closedReason: 'Negocio cerrado' };

  const proEx = input.exceptions.find((e) => e.professionalId === professionalId && e.date === date);
  if (proEx?.closed) return { intervals: [], closedReason: proEx.reason ?? 'Profesional no disponible' };
  const proWeekly = input.professionalHours.find((h) => h.professionalId === professionalId);
  const proRanges = proEx ? proEx.intervals : (proWeekly?.days[weekday] ?? []);

  return {
    intervals: intersectAll(localIntervals(date, bizRanges, zone), localIntervals(date, proRanges, zone)),
    closedReason: null,
  };
}

/** Intervalo que la cita ocuparía, con buffers. */
export function requiredInterval(start: number, service: Pick<Service, 'durationMin' | 'bufferBeforeMin' | 'bufferAfterMin'>): Interval {
  return {
    start: start - service.bufferBeforeMin * MINUTE,
    end: start + (service.durationMin + service.bufferAfterMin) * MINUTE,
  };
}

export function isProfessionalBookable(p: Professional, service: Service, enabled: ReadonlySet<string>): boolean {
  return p.active && service.active && p.businessId === service.businessId && enabled.has(p.id);
}

/**
 * Evalúa si un inicio concreto es válido para un profesional. Usado tanto para
 * generar opciones como para revalidar dentro de la operación de reserva.
 */
export function checkSlot(input: AvailabilityInput, professionalId: string, start: number): string | null {
  const pro = input.professionals.find((p) => p.id === professionalId);
  if (!pro || !isProfessionalBookable(pro, input.service, input.enabledProfessionalIds)) {
    return 'El profesional no está habilitado para este servicio.';
  }
  const now = input.now.getTime();
  if (start < now + input.policy.minLeadMin * MINUTE) return 'El horario no respeta la anticipación mínima.';
  if (start > now + input.policy.maxHorizonDays * 24 * 60 * MINUTE) return 'El horario supera el horizonte de reserva.';

  const service: Interval = { start, end: start + input.service.durationMin * MINUTE };
  const { intervals } = workingIntervals(input, professionalId);
  // El servicio debe caber íntegro en un único intervalo de jornada (un descanso lo divide).
  if (!intervals.some((w) => contains(w, service))) return 'El horario está fuera de la jornada o atraviesa un descanso.';

  const needed = requiredInterval(start, input.service);
  const busy = input.occupancies.some(
    (o) =>
      o.active &&
      o.professionalId === professionalId &&
      o.appointmentId !== (input.excludeAppointmentId ?? '__none__') &&
      overlaps(needed, { start: o.start.getTime(), end: o.end.getTime() }),
  );
  if (busy) return 'El horario ya está ocupado.';
  return null;
}

/**
 * Genera opciones para una fecha. Granularidad configurable (p. ej. 15 min) alineada
 * al reloj local; la granularidad no cambia la duración del servicio.
 * El resultado no es una garantía ni una reserva.
 */
export function computeAvailability(input: AvailabilityInput, onlyProfessionalId?: string): DayResult {
  if (!input.service.active) throw new DomainError('POLICY_VIOLATION', 'El servicio está archivado.');
  const step = input.policy.slotGranularityMin * MINUTE;
  const candidates = input.professionals.filter(
    (p) =>
      (!onlyProfessionalId || p.id === onlyProfessionalId) &&
      isProfessionalBookable(p, input.service, input.enabledProfessionalIds),
  );

  const slots: CandidateSlot[] = [];
  let closedReason: string | null = null;
  for (const pro of candidates) {
    const { intervals, closedReason: reason } = workingIntervals(input, pro.id);
    closedReason ??= reason;
    for (const w of intervals) {
      const dayStart = localDateTime(input.date, '00:00', input.zone).toMillis();
      let t = dayStart + Math.ceil((w.start - dayStart) / step) * step;
      for (; t + input.service.durationMin * MINUTE <= w.end; t += step) {
        if (checkSlot(input, pro.id, t) === null) {
          slots.push({ start: t, end: t + input.service.durationMin * MINUTE, professionalId: pro.id });
        }
      }
    }
  }
  slots.sort((a, b) => a.start - b.start || a.professionalId.localeCompare(b.professionalId));
  return { slots, closedReason: slots.length === 0 ? closedReason : null };
}

/**
 * "Cualquiera disponible": menor carga del día (minutos ocupados) y después ID estable.
 * Política propuesta (sección 24), pendiente de aprobación.
 */
export function pickProfessional(
  candidateIds: string[],
  occupancies: CalendarOccupancy[],
  day: Interval,
): string | undefined {
  const load = (id: string) =>
    occupancies
      .filter((o) => o.active && o.professionalId === id && overlaps(day, { start: o.start.getTime(), end: o.end.getTime() }))
      .reduce((sum, o) => sum + (o.end.getTime() - o.start.getTime()), 0);
  return [...candidateIds].sort((a, b) => load(a) - load(b) || a.localeCompare(b))[0];
}
