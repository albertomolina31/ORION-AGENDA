import type { Money } from '@orion/contracts';

/**
 * Formato siempre en la zona del negocio (nunca la del teléfono) y en español de México.
 */
const LOCALE = 'es-MX';

function parts(iso: string | Date, timeZone: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, ...opts }).format(typeof iso === 'string' ? new Date(iso) : iso);
}

export const fmt = {
  time: (iso: string, tz: string) => parts(iso, tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
  range: (a: string, b: string, tz: string) => `${fmt.time(a, tz)} – ${fmt.time(b, tz)}`,
  /** "Lunes, 12 de octubre" */
  longDay: (iso: string | Date, tz: string) => capitalize(parts(iso, tz, { weekday: 'long', day: 'numeric', month: 'long' })),
  /** "12 de octubre" */
  dayMonth: (iso: string | Date, tz: string) => parts(iso, tz, { day: 'numeric', month: 'long' }),
  /** "21 sep" */
  shortDay: (iso: string | Date, tz: string) => parts(iso, tz, { day: 'numeric', month: 'short' }).replace('.', ''),
  /** "Mié, 14 oct" */
  weekdayShort: (iso: string | Date, tz: string) =>
    capitalize(parts(iso, tz, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')),
  /** "Octubre 2026" */
  monthYear: (iso: string | Date, tz: string) => capitalize(parts(iso, tz, { month: 'long', year: 'numeric' }).replace(' de ', ' ')),
  monthYearSince: (iso: string, tz: string) => parts(iso, tz, { month: 'long', year: 'numeric' }),
  money: (m: Money) =>
    new Intl.NumberFormat(LOCALE, { style: 'currency', currency: m.currency, maximumFractionDigits: 0 }).format(m.amountMinor / 100),
};

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Fecha local AAAA-MM-DD de un instante en la zona dada. */
export function localDate(at: Date | string, tz: string): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    typeof at === 'string' ? new Date(at) : at,
  );
  return p;
}

/** Suma días a una fecha AAAA-MM-DD (aritmética de calendario, sin zona). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Lunes de la semana de una fecha AAAA-MM-DD. */
export function startOfWeek(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

/** Mediodía UTC de una fecha local: útil para formatear el nombre del día sin cruzar fechas. */
export function noonOf(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

export function relativeDayLabel(iso: string, tz: string, today: string): string {
  const d = localDate(iso, tz);
  if (!today) return fmt.weekdayShort(iso, tz);
  if (d === today) return 'Hoy';
  if (d === addDays(today, 1)) return 'Mañana';
  return fmt.weekdayShort(iso, tz);
}
