import { z } from 'zod';

/** Instante ISO 8601 con zona/offset (p. ej. 2026-10-12T10:00:00.000-07:00 o ...Z). */
export const IsoDateTime = z.iso.datetime({ offset: true });
/** Fecha local del negocio, AAAA-MM-DD. */
export const LocalDate = z.iso.date();
/** Hora local HH:mm. */
export const LocalTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:mm');
export const Id = z.string().min(1).max(64);
/** Clave de operación generada por el cliente antes de enviar y reutilizada en reintentos. */
export const RequestId = z.string().min(8).max(64);

export const Money = z.object({
  /** Unidades menores enteras (centavos). Nunca flotantes. */
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
});
export type Money = z.infer<typeof Money>;

export const ErrorCode = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'SLOT_UNAVAILABLE',
  'APPOINTMENT_EXPIRED',
  'INVALID_TRANSITION',
  'STALE_VERSION',
  'POLICY_VIOLATION',
  'IDEMPOTENCY_CONFLICT',
  'INTEGRATION_UNAVAILABLE',
  'INTERNAL_ERROR',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorEnvelope = z.object({
  code: ErrorCode,
  message: z.string(),
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  requestId: z.string(),
  /** Contexto seguro adicional (p. ej. para volver a consultar disponibilidad). */
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

export const Page = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
  });

/** Indica que la respuesta proviene de adaptadores en memoria (sección 25). */
export const DataSource = z.enum(['SIMULATION', 'PERSISTENT']);
export type DataSource = z.infer<typeof DataSource>;
