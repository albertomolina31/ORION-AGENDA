import { z } from 'zod';
import { Id, IsoDateTime, LocalDate, Money, RequestId } from './common.js';

export const AppointmentStatus = z.enum([
  'PENDING_APPROVAL',
  'CONFIRMED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
  'COMPLETED',
  'NO_SHOW',
]);
export type AppointmentStatus = z.infer<typeof AppointmentStatus>;

/** Derivado de la identidad del actor/canal; nunca un campo enviado por el cliente. */
export const AppointmentSource = z.enum(['STAFF_APP', 'WHATSAPP', 'CONSUMER_LINK']);
export type AppointmentSource = z.infer<typeof AppointmentSource>;

export const AppointmentAction = z.enum(['approve', 'reject', 'cancel', 'reschedule', 'complete', 'no-show']);
export type AppointmentAction = z.infer<typeof AppointmentAction>;

export const DeliveryStatus = z.enum(['NOT_APPLICABLE', 'PENDING', 'SENT', 'DELIVERED', 'FAILED']);

export const Appointment = z.object({
  id: Id,
  businessId: Id,
  status: AppointmentStatus,
  source: AppointmentSource,
  startsAt: IsoDateTime,
  endsAt: IsoDateTime,
  timezone: z.string(),
  version: z.number().int().positive(),
  expiresAt: IsoDateTime.nullable(),
  customer: z.object({ id: Id, name: z.string(), firstVisit: z.boolean() }),
  professional: z.object({ id: Id, name: z.string(), initials: z.string(), colorKey: z.string() }),
  /** Snapshot de condiciones aplicadas al reservar; editar el servicio no lo altera. */
  service: z.object({ id: Id, name: z.string(), durationMin: z.number().int().positive(), price: Money }),
  policyVersion: z.number().int().positive(),
  /** Acciones que el actor actual puede ejecutar ahora según estado y permisos. */
  allowedActions: z.array(AppointmentAction),
  /** Aviso al cliente por canal externo; una cita puede estar confirmada con aviso fallido. */
  customerNotice: DeliveryStatus,
  createdAt: IsoDateTime,
});
export type Appointment = z.infer<typeof Appointment>;

export const AppointmentEvent = z.object({
  at: IsoDateTime,
  fromStatus: AppointmentStatus.nullable(),
  toStatus: AppointmentStatus,
  action: z.string(),
  actorName: z.string(),
  reason: z.string().nullable(),
});
export type AppointmentEvent = z.infer<typeof AppointmentEvent>;

export const AppointmentDetail = Appointment.extend({
  history: z.array(AppointmentEvent),
});
export type AppointmentDetail = z.infer<typeof AppointmentDetail>;

export const AgendaQuery = z.object({
  from: LocalDate,
  to: LocalDate.optional(),
  professionalId: Id.optional(),
  status: z.array(AppointmentStatus).optional(),
});
export type AgendaQuery = z.infer<typeof AgendaQuery>;

export const AgendaDaySummary = z.object({
  date: LocalDate,
  confirmed: z.number().int(),
  pending: z.number().int(),
  completed: z.number().int(),
  cancelled: z.number().int(),
  noShow: z.number().int(),
});
export type AgendaDaySummary = z.infer<typeof AgendaDaySummary>;

export const AgendaResponse = z.object({
  timezone: z.string(),
  from: LocalDate,
  to: LocalDate,
  appointments: z.array(Appointment),
  days: z.array(AgendaDaySummary),
  /** Instante en que el servidor calculó la respuesta (para mostrar datos desactualizados). */
  generatedAt: IsoDateTime,
});
export type AgendaResponse = z.infer<typeof AgendaResponse>;

export const CreateAppointmentRequest = z.object({
  requestId: RequestId,
  customerId: Id,
  serviceId: Id,
  /** null = "cualquiera disponible"; el servidor asigna dentro de la operación. */
  professionalId: Id.nullable(),
  startsAt: IsoDateTime,
});
export type CreateAppointmentRequest = z.infer<typeof CreateAppointmentRequest>;

export const TransitionRequest = z.object({
  requestId: RequestId,
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().max(280).optional(),
});
export type TransitionRequest = z.infer<typeof TransitionRequest>;

export const RescheduleRequest = TransitionRequest.extend({
  startsAt: IsoDateTime,
  professionalId: Id.optional(),
});
export type RescheduleRequest = z.infer<typeof RescheduleRequest>;

export const AvailabilityQuery = z.object({
  serviceId: Id,
  professionalId: Id.optional(),
  date: LocalDate,
  /** Al reprogramar, la propia cita no cuenta como ocupación. */
  excludeAppointmentId: Id.optional(),
});
export type AvailabilityQuery = z.infer<typeof AvailabilityQuery>;

export const Slot = z.object({
  startsAt: IsoDateTime,
  endsAt: IsoDateTime,
  localTime: z.string(),
  professionalIds: z.array(Id),
});
export type Slot = z.infer<typeof Slot>;

export const AvailabilityResponse = z.object({
  timezone: z.string(),
  date: LocalDate,
  serviceId: Id,
  slots: z.array(Slot),
  /** El slot mostrado no es garantía ni reserva. */
  calculatedAt: IsoDateTime,
  closedReason: z.string().nullable(),
});
export type AvailabilityResponse = z.infer<typeof AvailabilityResponse>;

export const OperationStatus = z.enum(['SUCCEEDED', 'FAILED', 'UNKNOWN']);
export const OperationResult = z.object({
  requestId: RequestId,
  status: OperationStatus,
  httpStatus: z.number().int().nullable(),
  body: z.unknown().nullable(),
});
export type OperationResult = z.infer<typeof OperationResult>;
