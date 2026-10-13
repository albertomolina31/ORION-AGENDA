import { z } from 'zod';
import { Id, IsoDateTime, LocalDate, RequestId } from './common.js';
import { AppointmentStatus } from './appointments.js';
import { TimeRange } from './business.js';

/** Edición de catálogo, equipo, horarios y bloqueos (P17–P19, L03–L05). */

export const SaveServiceRequest = z.object({
  requestId: RequestId,
  name: z.string().trim().min(2, 'Escribe al menos 2 caracteres').max(60),
  durationMin: z.number().int().min(5, 'Mínimo 5 minutos').max(600, 'Máximo 10 horas'),
  bufferBeforeMin: z.number().int().min(0).max(120),
  bufferAfterMin: z.number().int().min(0).max(120),
  priceMinor: z.number().int().min(0, 'El precio no puede ser negativo').max(10_000_000),
  professionalIds: z.array(Id).max(50),
  active: z.boolean().default(true),
});
export type SaveServiceRequest = z.input<typeof SaveServiceRequest>;

export const SaveProfessionalRequest = z.object({
  requestId: RequestId,
  name: z.string().trim().min(2, 'Escribe al menos 2 caracteres').max(60),
  colorKey: z.string().min(1),
  serviceIds: z.array(Id).max(100),
});
export type SaveProfessionalRequest = z.input<typeof SaveProfessionalRequest>;

export const ProfessionalStatusRequest = z.object({ requestId: RequestId, active: z.boolean() });

/** Cita afectada por un cambio de horario o una baja: se resuelve explícitamente. */
export const ScheduleConflict = z.object({
  appointmentId: Id,
  startsAt: IsoDateTime,
  endsAt: IsoDateTime,
  status: AppointmentStatus,
  customerName: z.string(),
  professionalName: z.string(),
  serviceName: z.string(),
});
export type ScheduleConflict = z.infer<typeof ScheduleConflict>;

export const ScheduleChangeResult = z.object({
  applied: z.boolean(),
  conflicts: z.array(ScheduleConflict),
});
export type ScheduleChangeResult = z.infer<typeof ScheduleChangeResult>;

export const WeeklyHoursRequest = z.object({
  requestId: RequestId,
  /** null = horario general del negocio. */
  professionalId: Id.nullable(),
  days: z.array(z.object({ weekday: z.number().int().min(1).max(7), intervals: z.array(TimeRange).max(4) })).max(7),
  /** true = solo calcula conflictos, no guarda. */
  dryRun: z.boolean().default(false),
});
export type WeeklyHoursRequest = z.input<typeof WeeklyHoursRequest>;

export const ScheduleExceptionDto = z.object({
  id: Id,
  professionalId: Id.nullable(),
  date: LocalDate,
  closed: z.boolean(),
  intervals: z.array(TimeRange),
  reason: z.string().nullable(),
});
export type ScheduleExceptionDto = z.infer<typeof ScheduleExceptionDto>;

export const ExceptionRequest = z.object({
  requestId: RequestId,
  professionalId: Id.nullable(),
  date: LocalDate,
  closed: z.boolean(),
  intervals: z.array(TimeRange).max(4),
  reason: z.string().trim().max(80).optional(),
  dryRun: z.boolean().default(false),
});
export type ExceptionRequest = z.input<typeof ExceptionRequest>;

export const Block = z.object({
  id: Id,
  professionalId: Id,
  professionalName: z.string(),
  colorKey: z.string(),
  startsAt: IsoDateTime,
  endsAt: IsoDateTime,
  reason: z.string().nullable(),
});
export type Block = z.infer<typeof Block>;

export const CreateBlockRequest = z.object({
  requestId: RequestId,
  professionalId: Id,
  startsAt: IsoDateTime,
  endsAt: IsoDateTime,
  reason: z.string().trim().max(80).optional(),
});
export type CreateBlockRequest = z.input<typeof CreateBlockRequest>;

export const SimpleCommand = z.object({ requestId: RequestId });
