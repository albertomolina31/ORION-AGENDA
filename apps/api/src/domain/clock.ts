import { DateTime } from 'luxon';

/** Reloj inyectable: las reglas nunca leen la hora del sistema directamente (sección 25). */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Reloj fijo y ajustable para pruebas de vencimientos y carreras. */
export class ManualClock implements Clock {
  private current: number;
  constructor(start: Date | string) {
    this.current = new Date(start).getTime();
  }
  now(): Date {
    return new Date(this.current);
  }
  set(at: Date | string): void {
    this.current = new Date(at).getTime();
  }
  advanceMinutes(min: number): void {
    this.current += min * 60_000;
  }
}

/**
 * Reloj de simulación: arranca en una hora local del negocio (p. ej. hoy 09:41)
 * y avanza en tiempo real. Permite demos coherentes con los fixtures.
 */
export class SimulatedClock implements Clock {
  private readonly offsetMs: number;
  constructor(zone: string, localTime: string, base: Date = new Date()) {
    const [h, m] = localTime.split(':').map(Number);
    const start = DateTime.fromJSDate(base, { zone }).set({ hour: h, minute: m, second: 0, millisecond: 0 });
    this.offsetMs = start.toMillis() - base.getTime();
  }
  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }
}
