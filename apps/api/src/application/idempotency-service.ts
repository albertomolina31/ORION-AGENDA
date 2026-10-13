import { createHash } from 'node:crypto';
import type { OperationResult } from '@orion/contracts';
import type { Clock } from '../domain/clock.js';
import { DomainError, httpStatusFor } from '../domain/errors.js';
import type { ActorContext } from '../domain/model.js';
import type { Repositories, UnitOfWork } from './ports.js';

const RETENTION_MS = 48 * 60 * 60 * 1000;

class ReplayedError extends DomainError {}

/**
 * Idempotencia por actor/negocio/operación/clave (sección 10). Mismo payload y clave →
 * mismo resultado (éxito o error de negocio). Distinto payload con la misma clave → rechazo.
 */
export class IdempotencyService {
  constructor(
    private readonly repos: Repositories,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  private hash(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  async execute<T>(
    actor: ActorContext,
    operation: string,
    requestId: string,
    payload: unknown,
    fn: () => Promise<T>,
  ): Promise<T> {
    const scope = `${actor.userId}|${actor.businessId}|${operation}|${requestId}`;
    const requestHash = this.hash({ operation, payload });
    const scopes = [actor.businessId];
    try {
      return await this.uow.run(scopes, async () => {
        const existing = await this.repos.idempotency.get(scope);
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new ReplayedError('IDEMPOTENCY_CONFLICT', 'Esta clave de operación ya se usó con otros datos.');
          }
          if (existing.httpStatus < 400) return existing.body as T;
          const e = existing.body as { code: DomainError['code']; message: string; details?: Record<string, unknown> };
          throw new ReplayedError(e.code, e.message, e.details);
        }
        const result = await fn();
        await this.repos.idempotency.put(this.record(scope, requestHash, 200, result));
        return result;
      });
    } catch (err) {
      if (err instanceof DomainError && !(err instanceof ReplayedError)) {
        await this.uow.run(scopes, async () => {
          if (!(await this.repos.idempotency.get(scope))) {
            await this.repos.idempotency.put(
              this.record(scope, requestHash, httpStatusFor[err.code], { code: err.code, message: err.message, details: err.details }),
            );
          }
        });
      }
      throw err;
    }
  }

  /** Resolver un timeout sin duplicar: consultar el resultado antes de reintentar con otra clave. */
  async operation(actorId: string, requestId: string): Promise<OperationResult> {
    const r = await this.repos.idempotency.findByRequestId(actorId, requestId);
    if (!r) return { requestId, status: 'UNKNOWN', httpStatus: null, body: null };
    return { requestId, status: r.httpStatus < 400 ? 'SUCCEEDED' : 'FAILED', httpStatus: r.httpStatus, body: r.body };
  }

  private record(scope: string, requestHash: string, httpStatus: number, body: unknown) {
    const now = this.clock.now();
    return { scope, requestHash, httpStatus, body, createdAt: now, expiresAt: new Date(now.getTime() + RETENTION_MS) };
  }
}
