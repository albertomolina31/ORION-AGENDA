import { z } from 'zod';
import { Id, IsoDateTime } from './common.js';

/** Envelope común de eventos (sección 13). Payload mínimo, sin teléfono/nombre. */
export const EventEnvelope = <T extends z.ZodTypeAny>(payload: T) =>
  z.object({
    eventId: Id,
    eventType: z.string(),
    schemaVersion: z.number().int().positive(),
    occurredAt: IsoDateTime,
    businessId: Id,
    aggregateId: Id,
    aggregateVersion: z.number().int().positive(),
    correlationId: z.string(),
    payload,
  });

export const AppointmentEventType = z.enum([
  'appointment.confirmed',
  'appointment.pending',
  'appointment.rejected',
  'appointment.expired',
  'appointment.cancelled',
  'appointment.rescheduled',
  'appointment.completed',
  'appointment.no_show',
]);
export type AppointmentEventType = z.infer<typeof AppointmentEventType>;

/** Consumido por el módulo de fidelidad de Sergio (appointment.completed.v1). */
export const AppointmentCompletedV1 = EventEnvelope(
  z.object({
    appointmentId: Id,
    customerId: Id,
    serviceId: Id,
    professionalId: Id,
    completedAt: IsoDateTime,
  }),
);
export type AppointmentCompletedV1 = z.infer<typeof AppointmentCompletedV1>;
