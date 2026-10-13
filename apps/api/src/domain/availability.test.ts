import { describe, expect, it } from 'vitest';
import { type AvailabilityInput, checkSlot, computeAvailability, pickProfessional } from './availability.js';
import { localDateTime } from './local-time.js';
import type { CalendarOccupancy, Professional, Service } from './model.js';
import { defaultPolicy } from '../fixtures/seed.js';

const ZONE = 'America/Mazatlan';
const DATE = '2026-10-12'; // lunes
const t = (hhmm: string, date = DATE, zone = ZONE) => localDateTime(date, hhmm, zone).toMillis();

const pro = (id: string, extra: Partial<Professional> = {}): Professional => ({
  id,
  businessId: 'b1',
  name: id,
  colorKey: 'lavender',
  userId: null,
  active: true,
  ...extra,
});
const service = (durationMin: number, extra: Partial<Service> = {}): Service => ({
  id: 's1',
  businessId: 'b1',
  name: 'Servicio',
  durationMin,
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  priceMinor: 10000,
  currency: 'MXN',
  active: true,
  ...extra,
});
const occ = (professionalId: string, start: string, end: string, extra: Partial<CalendarOccupancy> = {}): CalendarOccupancy => ({
  id: `o_${start}`,
  businessId: 'b1',
  professionalId,
  start: new Date(t(start)),
  end: new Date(t(end)),
  kind: 'APPOINTMENT',
  appointmentId: `a_${start}`,
  active: true,
  label: null,
  ...extra,
});

function input(over: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    date: DATE,
    zone: ZONE,
    now: new Date(t('07:00')),
    policy: { ...defaultPolicy, minLeadMin: 0 },
    service: service(45),
    professionals: [pro('ana'), pro('luis')],
    enabledProfessionalIds: new Set(['ana', 'luis']),
    businessHours: { businessId: 'b1', professionalId: null, days: { 1: [{ start: '09:00', end: '20:00' }] } },
    professionalHours: [
      { businessId: 'b1', professionalId: 'ana', days: { 1: [{ start: '09:00', end: '11:00' }, { start: '11:30', end: '13:00' }] } },
      { businessId: 'b1', professionalId: 'luis', days: { 1: [{ start: '09:00', end: '19:00' }] } },
    ],
    exceptions: [],
    occupancies: [],
    ...over,
  };
}

describe('Motor de disponibilidad (L05/L06, sección 25)', () => {
  it('Dado que Ana trabaja 09:00–13:00 y descansa 11:00–11:30, cuando piden 45 min desde 10:30, entonces se rechaza', () => {
    expect(checkSlot(input(), 'ana', t('10:30'))).toMatch(/descanso/);
    // 10:15 sí cabe íntegro antes del descanso.
    expect(checkSlot(input(), 'ana', t('10:15'))).toBeNull();
  });

  it('Dado Luis con cita 10:00–10:45 y buffer posterior de 15 min, 10:45 no está disponible y 11:00 sí', () => {
    const i = input({ service: service(30), occupancies: [occ('luis', '10:00', '11:00')] });
    expect(checkSlot(i, 'luis', t('10:45'))).toMatch(/ocupado/);
    expect(checkSlot(i, 'luis', t('11:00'))).toBeNull();
  });

  it('Dos citas adyacentes sin buffer son compatibles; con buffer del nuevo servicio que se cruza, se rechaza', () => {
    const base = input({ service: service(30), occupancies: [occ('luis', '10:00', '10:30')] });
    expect(checkSlot(base, 'luis', t('10:30'))).toBeNull();
    const withBuffer = input({ service: service(30, { bufferBeforeMin: 10 }), occupancies: [occ('luis', '10:00', '10:30')] });
    expect(checkSlot(withBuffer, 'luis', t('10:30'))).toMatch(/ocupado/);
  });

  it('Un bloqueo manual comparte la misma protección que una cita', () => {
    const i = input({ occupancies: [occ('luis', '12:00', '13:00', { kind: 'BLOCK', appointmentId: null })] });
    expect(checkSlot(i, 'luis', t('12:30'))).toMatch(/ocupado/);
  });

  it('La granularidad de 15 min no cambia la duración del servicio de 45 min', () => {
    const { slots } = computeAvailability(input(), 'ana');
    expect(slots.map((s) => localDateTime(DATE, '00:00', ZONE).plus({ milliseconds: s.start - t('00:00') }).toFormat('HH:mm'))).toEqual([
      '09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '11:30', '11:45', '12:00', '12:15',
    ]);
    slots.forEach((s) => expect(s.end - s.start).toBe(45 * 60_000));
  });

  it('Un profesional desactivado o no habilitado para el servicio no recibe reservas', () => {
    expect(computeAvailability(input({ professionals: [pro('ana', { active: false }), pro('luis')] }), 'ana').slots).toHaveLength(0);
    expect(computeAvailability(input({ enabledProfessionalIds: new Set(['luis']) }), 'ana').slots).toHaveLength(0);
  });

  it('Respeta anticipación mínima y horizonte máximo', () => {
    const i = input({ now: new Date(t('10:00')), policy: { ...defaultPolicy, minLeadMin: 60 } });
    expect(checkSlot(i, 'luis', t('10:45'))).toMatch(/anticipación/);
    expect(checkSlot(i, 'luis', t('11:00'))).toBeNull();
    const far = input({ now: new Date(t('10:00', '2026-08-01')), policy: { ...defaultPolicy, maxHorizonDays: 60, minLeadMin: 0 } });
    expect(checkSlot(far, 'luis', t('10:00'))).toMatch(/horizonte/);
  });

  it('Precedencia: cierre explícito del negocio anula la jornada; excepción del profesional la sustituye', () => {
    const closed = input({ exceptions: [{ id: 'e1', businessId: 'b1', professionalId: null, date: DATE, closed: true, intervals: [], reason: 'Feriado' }] });
    const r = computeAvailability(closed);
    expect(r.slots).toHaveLength(0);
    expect(r.closedReason).toBe('Feriado');
    const special = input({
      exceptions: [{ id: 'e2', businessId: 'b1', professionalId: 'luis', date: DATE, closed: false, intervals: [{ start: '15:00', end: '16:00' }], reason: null }],
    });
    expect(computeAvailability(special, 'luis').slots).toHaveLength(2); // 15:00 y 15:15
  });

  it('"Cualquiera": asigna menor carga del día y desempata por ID estable', () => {
    const occs = [occ('ana', '09:00', '10:00'), occ('luis', '09:00', '09:30')];
    const day = { start: t('00:00'), end: t('23:59') };
    expect(pickProfessional(['ana', 'luis'], occs, day)).toBe('luis');
    expect(pickProfessional(['luis', 'ana'], [], day)).toBe('ana');
  });

  it('Zona con cambio de horario: el día del salto adelante no inventa horas inexistentes', () => {
    const zone = 'America/New_York';
    const date = '2026-03-08'; // domingo, 02:00 → 03:00
    const i = input({
      date,
      zone,
      now: new Date(t('00:00', '2026-03-07', zone)),
      service: service(60),
      businessHours: { businessId: 'b1', professionalId: null, days: { 7: [{ start: '01:00', end: '05:00' }] } },
      professionalHours: [{ businessId: 'b1', professionalId: 'luis', days: { 7: [{ start: '01:00', end: '05:00' }] } }],
    });
    const { slots } = computeAvailability(i, 'luis');
    // 01:00–05:00 local dura 3 h reales: no puede haber más inicios que en 3 h.
    expect(slots.length).toBe(9);
    slots.forEach((s) => expect(s.end - s.start).toBe(60 * 60_000));
  });

  it('Horario nocturno no soportado: se rechaza configurarlo en vez de calcular mal', () => {
    const i = input({ professionalHours: [{ businessId: 'b1', professionalId: 'luis', days: { 1: [{ start: '22:00', end: '02:00' }] } }] });
    expect(() => computeAvailability(i, 'luis')).toThrow(/nocturno/);
  });
});
