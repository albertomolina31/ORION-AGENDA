import type { AppointmentAction, AppointmentStatus, BookingPolicy } from '@orion/contracts';
import { DomainError } from './errors.js';
import { MINUTE } from './interval.js';
import type { Appointment } from './model.js';

/**
 * Máquina de estados de la cita (sección 9). Reglas puras: reciben la hora actual
 * y devuelven el estado destino o un error estable. Persistir y emitir eventos es
 * responsabilidad del caso de uso.
 */

export const ACTIVE_STATUSES: ReadonlySet<AppointmentStatus> = new Set(['PENDING_APPROVAL', 'CONFIRMED']);

export function isExpired(appt: Pick<Appointment, 'status' | 'expiresAt'>, now: Date): boolean {
  // El plazo válido es estrictamente antes del límite: aprobar a las 12:30 con
  // vencimiento 12:30 se rechaza como vencida.
  return appt.status === 'PENDING_APPROVAL' && appt.expiresAt !== null && now.getTime() >= appt.expiresAt.getTime();
}

export interface TransitionContext {
  now: Date;
  policy: BookingPolicy;
  /** Motivo; obligatorio para excepciones de política. */
  reason?: string | undefined;
}

export interface TransitionOutcome {
  to: AppointmentStatus;
  /** La acción liberó el horario (desactivar ocupación). */
  releasesSlot: boolean;
  eventType: string;
}

const invalid = (from: AppointmentStatus, action: string) =>
  new DomainError('INVALID_TRANSITION', `No se puede ${actionVerb[action] ?? action} una cita en estado ${from}.`, {
    currentStatus: from,
  });

const actionVerb: Record<string, string> = {
  approve: 'aprobar',
  reject: 'rechazar',
  cancel: 'cancelar',
  reschedule: 'reprogramar',
  complete: 'completar',
  'no-show': 'marcar ausencia de',
  expire: 'vencer',
};

export function decideTransition(
  appt: Pick<Appointment, 'status' | 'expiresAt' | 'startsAt'>,
  action: AppointmentAction | 'expire',
  ctx: TransitionContext,
): TransitionOutcome {
  const now = ctx.now.getTime();
  const starts = appt.startsAt.getTime();
  const from = appt.status;

  switch (action) {
    case 'approve': {
      if (from !== 'PENDING_APPROVAL') throw invalid(from, action);
      if (isExpired(appt, ctx.now)) throw new DomainError('APPOINTMENT_EXPIRED', 'La solicitud venció antes de aprobarse.');
      if (now >= starts) throw new DomainError('POLICY_VIOLATION', 'No se puede aprobar una cita que ya comenzó.');
      return { to: 'CONFIRMED', releasesSlot: false, eventType: 'appointment.confirmed' };
    }
    case 'reject': {
      if (from !== 'PENDING_APPROVAL') throw invalid(from, action);
      if (isExpired(appt, ctx.now)) throw new DomainError('APPOINTMENT_EXPIRED', 'La solicitud ya había vencido.');
      return { to: 'REJECTED', releasesSlot: true, eventType: 'appointment.rejected' };
    }
    case 'expire': {
      if (!isExpired(appt, ctx.now)) throw invalid(from, action);
      return { to: 'EXPIRED', releasesSlot: true, eventType: 'appointment.expired' };
    }
    case 'cancel': {
      if (from !== 'PENDING_APPROVAL' && from !== 'CONFIRMED') throw invalid(from, action);
      // Excepción de plazo por personal autorizado: requiere motivo (L10).
      const cutoff = starts - ctx.policy.customerCancelUntilMin * MINUTE;
      if (now > cutoff && !ctx.reason?.trim()) {
        throw new DomainError('POLICY_VIOLATION', 'Fuera del plazo de cancelación: indica un motivo para registrar la excepción.', {
          requiresReason: true,
        });
      }
      return { to: 'CANCELLED', releasesSlot: true, eventType: 'appointment.cancelled' };
    }
    case 'complete': {
      if (from !== 'CONFIRMED') throw invalid(from, action);
      if (now < starts) throw new DomainError('POLICY_VIOLATION', 'No se puede completar una cita antes de su inicio.');
      return { to: 'COMPLETED', releasesSlot: false, eventType: 'appointment.completed' };
    }
    case 'no-show': {
      if (from !== 'CONFIRMED') throw invalid(from, action);
      if (now < starts + ctx.policy.noShowGraceMin * MINUTE) {
        throw new DomainError(
          'POLICY_VIOLATION',
          `La ausencia se registra a partir de ${ctx.policy.noShowGraceMin} minutos después del inicio.`,
        );
      }
      return { to: 'NO_SHOW', releasesSlot: false, eventType: 'appointment.no_show' };
    }
    case 'reschedule': {
      // MVP: solo confirmadas. Una pendiente se cancela y se solicita de nuevo.
      if (from !== 'CONFIRMED') throw invalid(from, action);
      if (now >= starts) throw new DomainError('POLICY_VIOLATION', 'No se puede reprogramar una cita que ya comenzó.');
      return { to: 'CONFIRMED', releasesSlot: false, eventType: 'appointment.rescheduled' };
    }
  }
}

/** Acciones que el estado y la hora permiten ahora (sin considerar permisos). */
export function actionsAllowedByState(
  appt: Pick<Appointment, 'status' | 'expiresAt' | 'startsAt'>,
  ctx: TransitionContext,
): AppointmentAction[] {
  const all: AppointmentAction[] = ['approve', 'reject', 'reschedule', 'complete', 'no-show', 'cancel'];
  return all.filter((a) => {
    try {
      decideTransition(appt, a, { ...ctx, reason: 'probe' });
      return true;
    } catch {
      return false;
    }
  });
}
