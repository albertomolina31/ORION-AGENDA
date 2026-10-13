import type { ErrorCode } from '@orion/contracts';

/** Error de dominio con código estable (sección 10). Nunca incluye trazas internas. */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const httpStatusFor: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SLOT_UNAVAILABLE: 409,
  APPOINTMENT_EXPIRED: 409,
  INVALID_TRANSITION: 409,
  STALE_VERSION: 409,
  POLICY_VIOLATION: 422,
  IDEMPOTENCY_CONFLICT: 422,
  INTEGRATION_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};
