import { DateTime } from 'luxon';
import { DomainError } from './errors.js';
import type { Interval } from './interval.js';

/**
 * Conversión de reglas locales a instantes usando la zona IANA del negocio
 * (nunca la del teléfono).
 *
 * Política de cambio de horario (propuesta, sección 8 paso 3):
 * - Hora local inexistente (salto adelante): luxon la desplaza hacia delante; el
 *   intervalo se acorta, nunca se inventa tiempo.
 * - Hora local ambigua (salto atrás): se usa la primera ocurrencia (offset anterior).
 */
export function localDateTime(date: string, time: string, zone: string): DateTime {
  const [h, m] = time.split(':').map(Number);
  const dt = DateTime.fromISO(date, { zone }).set({ hour: h, minute: m, second: 0, millisecond: 0 });
  if (!dt.isValid) throw new DomainError('VALIDATION_ERROR', `Fecha u hora inválida: ${date} ${time}`);
  return dt;
}

export function localIntervals(date: string, ranges: Array<{ start: string; end: string }>, zone: string): Interval[] {
  return ranges
    .map((r) => {
      if (r.end <= r.start) {
        // Horario nocturno no soportado en el piloto: se impide configurarlo (L05).
        throw new DomainError('VALIDATION_ERROR', `Intervalo inválido ${r.start}–${r.end}; el horario nocturno no está soportado.`);
      }
      return {
        start: localDateTime(date, r.start, zone).toMillis(),
        end: localDateTime(date, r.end, zone).toMillis(),
      };
    })
    .filter((i) => i.start < i.end);
}

/** Día ISO 1..7 de una fecha local. */
export function isoWeekday(date: string, zone: string): number {
  return DateTime.fromISO(date, { zone }).weekday;
}

/** Límites [00:00, 00:00 del día siguiente) de una fecha local. */
export function localDayBounds(date: string, zone: string): Interval {
  const start = DateTime.fromISO(date, { zone }).startOf('day');
  return { start: start.toMillis(), end: start.plus({ days: 1 }).toMillis() };
}

export function toLocalDate(at: Date | number, zone: string): string {
  const dt = typeof at === 'number' ? DateTime.fromMillis(at, { zone }) : DateTime.fromJSDate(at, { zone });
  return dt.toISODate()!;
}

export function toLocalTime(at: Date | number, zone: string): string {
  const dt = typeof at === 'number' ? DateTime.fromMillis(at, { zone }) : DateTime.fromJSDate(at, { zone });
  return dt.toFormat('HH:mm');
}

/** ISO con offset de la zona del negocio (más legible que Z para depurar). */
export function toZonedIso(at: Date | number, zone: string): string {
  const dt = typeof at === 'number' ? DateTime.fromMillis(at, { zone }) : DateTime.fromJSDate(at, { zone });
  return dt.toISO()!;
}

export function addDaysLocal(date: string, days: number, zone: string): string {
  return DateTime.fromISO(date, { zone }).plus({ days }).toISODate()!;
}
