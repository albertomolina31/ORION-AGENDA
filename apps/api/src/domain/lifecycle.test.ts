import { describe, expect, it } from 'vitest';
import { defaultPolicy } from '../fixtures/seed.js';
import { actionsAllowedByState, decideTransition } from './lifecycle.js';

const at = (iso: string) => new Date(iso);
const pending = { status: 'PENDING_APPROVAL' as const, expiresAt: at('2026-10-12T12:30:00-07:00'), startsAt: at('2026-10-12T17:00:00-07:00') };
const confirmed = { status: 'CONFIRMED' as const, expiresAt: null, startsAt: at('2026-10-12T16:00:00-07:00') };
const ctx = (now: string, reason?: string) => ({ now: at(now), policy: defaultPolicy, reason });

describe('Estados de cita (sección 9)', () => {
  it('Dada una solicitud que vence a las 12:30, aprobar exactamente a las 12:30 se rechaza como vencida', () => {
    expect(() => decideTransition(pending, 'approve', ctx('2026-10-12T12:30:00-07:00'))).toThrow(
      expect.objectContaining({ code: 'APPOINTMENT_EXPIRED' }),
    );
    expect(decideTransition(pending, 'approve', ctx('2026-10-12T12:29:59-07:00')).to).toBe('CONFIRMED');
  });

  it('Vencer solo procede con el plazo cumplido y libera el horario', () => {
    expect(() => decideTransition(pending, 'expire', ctx('2026-10-12T12:00:00-07:00'))).toThrow();
    const o = decideTransition(pending, 'expire', ctx('2026-10-12T12:30:00-07:00'));
    expect(o).toMatchObject({ to: 'EXPIRED', releasesSlot: true });
  });

  it('No se completa antes del inicio; ausencia solo después del margen', () => {
    expect(() => decideTransition(confirmed, 'complete', ctx('2026-10-12T15:59:00-07:00'))).toThrow(/antes de su inicio/);
    expect(decideTransition(confirmed, 'complete', ctx('2026-10-12T16:00:00-07:00')).to).toBe('COMPLETED');
    expect(() => decideTransition(confirmed, 'no-show', ctx('2026-10-12T16:10:00-07:00'))).toThrow(/15 minutos/);
    expect(decideTransition(confirmed, 'no-show', ctx('2026-10-12T16:15:00-07:00')).to).toBe('NO_SHOW');
  });

  it('Cancelar dentro del plazo de política exige motivo (excepción auditada)', () => {
    expect(() => decideTransition(confirmed, 'cancel', ctx('2026-10-12T15:00:00-07:00'))).toThrow(
      expect.objectContaining({ code: 'POLICY_VIOLATION' }),
    );
    expect(decideTransition(confirmed, 'cancel', ctx('2026-10-12T15:00:00-07:00', 'Cliente enfermo')).to).toBe('CANCELLED');
    expect(decideTransition(confirmed, 'cancel', ctx('2026-10-12T09:00:00-07:00')).to).toBe('CANCELLED');
  });

  it('Estados finales no admiten transiciones; REPROGRAMMED no existe como estado', () => {
    for (const status of ['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'] as const) {
      expect(actionsAllowedByState({ ...confirmed, status }, ctx('2026-10-12T10:00:00-07:00'))).toEqual([]);
    }
    expect(decideTransition(confirmed, 'reschedule', ctx('2026-10-12T10:00:00-07:00')).to).toBe('CONFIRMED');
  });

  it('Una solicitud pendiente no se reprograma (se cancela y se solicita de nuevo)', () => {
    expect(() => decideTransition(pending, 'reschedule', ctx('2026-10-12T10:00:00-07:00'))).toThrow(
      expect.objectContaining({ code: 'INVALID_TRANSITION' }),
    );
  });
});
