import { z } from 'zod';
import { WidgetPrivacy } from './widgets.js';
import { Id, LocalTime, Money } from './common.js';
import { BusinessCategory, BusinessStatus } from './identity.js';
import { RequestId } from './common.js';

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
  /** Máximo que los widgets de inicio pueden mostrar de un cliente; cada persona puede ocultar más. */
  widgetPrivacy: WidgetPrivacy,
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

export const SLOT_GRANULARITIES = [5, 10, 15, 20, 30, 60] as const;

/** Cambio de política: crea una versión nueva; las citas existentes conservan la suya (L17). */
export const UpdatePolicyRequest = z.object({
  requestId: RequestId,
  confirmationMode: ConfirmationMode,
  slotGranularityMin: z.number().int().refine((n) => (SLOT_GRANULARITIES as readonly number[]).includes(n), 'Intervalo no válido'),
  minLeadMin: z.number().int().min(0).max(7 * 24 * 60),
  maxHorizonDays: z.number().int().min(1).max(365),
  approvalWindowMin: z.number().int().min(5).max(24 * 60),
  customerCancelUntilMin: z.number().int().min(0).max(7 * 24 * 60),
  customerRescheduleUntilMin: z.number().int().min(0).max(7 * 24 * 60),
  noShowGraceMin: z.number().int().min(0).max(120),
  dryRun: z.boolean().default(false),
});
export type UpdatePolicyRequest = z.input<typeof UpdatePolicyRequest>;

export const PolicyChange = z.object({ field: z.string(), label: z.string(), from: z.string(), to: z.string() });

export const PolicyChangeResult = z.object({
  applied: z.boolean(),
  policy: BookingPolicy,
  changes: z.array(PolicyChange),
  /** Advertencias de consistencia entre parámetros (sección 24). */
  warnings: z.array(z.string()),
  /** Citas activas que seguirán usando su versión anterior. */
  appointmentsKeepingPreviousVersion: z.number().int(),
});
export type PolicyChangeResult = z.infer<typeof PolicyChangeResult>;

export const PolicyHistoryItem = z.object({
  version: z.number().int(),
  changedAt: z.iso.datetime({ offset: true }),
  changedBy: z.string(),
  policy: BookingPolicy,
});
export type PolicyHistoryItem = z.infer<typeof PolicyHistoryItem>;

export const UpdateProfileRequest = z.object({
  requestId: RequestId,
  name: z.string().trim().min(2, 'Escribe al menos 2 caracteres').max(80),
  category: BusinessCategory,
  /** Pausar la recepción de reservas externas no suspende la cuenta (L02). */
  acceptingExternalBookings: z.boolean(),
  /** Si se omite, se conserva el valor actual. */
  widgetPrivacy: WidgetPrivacy.optional(),
});
export type UpdateProfileRequest = z.input<typeof UpdateProfileRequest>;
