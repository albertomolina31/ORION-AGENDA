import { z } from 'zod';
import { Id, LocalTime, Money } from './common.js';
import { BusinessCategory, BusinessStatus } from './identity.js';

export const ConfirmationMode = z.enum(['AUTOMATIC', 'MANUAL']);
export type ConfirmationMode = z.infer<typeof ConfirmationMode>;

/** Parámetros de la sección 24: propuestos, configurables, no aprobados. */
export const BookingPolicy = z.object({
  version: z.number().int().positive(),
  confirmationMode: ConfirmationMode,
  slotGranularityMin: z.number().int().positive(),
  minLeadMin: z.number().int().nonnegative(),
  maxHorizonDays: z.number().int().positive(),
  approvalWindowMin: z.number().int().positive(),
  customerCancelUntilMin: z.number().int().nonnegative(),
  customerRescheduleUntilMin: z.number().int().nonnegative(),
  noShowGraceMin: z.number().int().nonnegative(),
});
export type BookingPolicy = z.infer<typeof BookingPolicy>;

export const IntegrationStatus = z.enum(['CONNECTED', 'NOT_CONNECTED', 'ERROR', 'ACTION_REQUIRED']);
export type IntegrationStatus = z.infer<typeof IntegrationStatus>;

export const Integration = z.object({
  key: z.enum(['WHATSAPP', 'APPLE_WALLET', 'GOOGLE_WALLET']),
  label: z.string(),
  description: z.string(),
  status: IntegrationStatus,
  statusLabel: z.string(),
});
export type Integration = z.infer<typeof Integration>;

export const SetupItem = z.object({
  key: z.enum(['NAME', 'TIMEZONE', 'PROFESSIONAL', 'SERVICE', 'WORKING_HOURS', 'POLICY']),
  label: z.string(),
  done: z.boolean(),
});

export const BusinessProfile = z.object({
  id: Id,
  name: z.string(),
  category: BusinessCategory,
  categoryLabel: z.string(),
  timezone: z.string(),
  currency: z.string().length(3),
  status: BusinessStatus,
  acceptingExternalBookings: z.boolean(),
  policy: BookingPolicy,
  setupChecklist: z.array(SetupItem),
  integrations: z.array(Integration),
});
export type BusinessProfile = z.infer<typeof BusinessProfile>;

export const Service = z.object({
  id: Id,
  name: z.string(),
  durationMin: z.number().int().positive(),
  bufferBeforeMin: z.number().int().nonnegative(),
  bufferAfterMin: z.number().int().nonnegative(),
  price: Money,
  active: z.boolean(),
  professionalIds: z.array(Id),
});
export type Service = z.infer<typeof Service>;

export const Professional = z.object({
  id: Id,
  name: z.string(),
  initials: z.string(),
  colorKey: z.string(),
  active: z.boolean(),
  /** Un profesional puede existir sin usuario de acceso. */
  hasUserAccess: z.boolean(),
  serviceIds: z.array(Id),
});
export type Professional = z.infer<typeof Professional>;

export const TimeRange = z.object({ start: LocalTime, end: LocalTime });

export const WeeklySchedule = z.object({
  professionalId: Id.nullable(),
  /** 1 = lunes … 7 = domingo (ISO). */
  days: z.array(
    z.object({
      weekday: z.number().int().min(1).max(7),
      intervals: z.array(TimeRange),
    }),
  ),
});
export type WeeklySchedule = z.infer<typeof WeeklySchedule>;

export const SchedulesResponse = z.object({
  timezone: z.string(),
  business: WeeklySchedule,
  professionals: z.array(WeeklySchedule),
  /** Excepciones de hoy en adelante (cierres y horarios especiales). */
  exceptions: z.array(
    z.object({
      id: Id,
      professionalId: Id.nullable(),
      date: z.iso.date(),
      closed: z.boolean(),
      intervals: z.array(TimeRange),
      reason: z.string().nullable(),
    }),
  ),
});
export type SchedulesResponse = z.infer<typeof SchedulesResponse>;
