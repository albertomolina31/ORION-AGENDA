import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { OrionContainer } from '../container.js';
import { DomainError } from '../domain/errors.js';
import type { OrionRequest } from './request-context.js';
import type { SimulatedSessionStore } from './sessions.js';
import { CONTAINER, SESSIONS } from './tokens.js';

function bearer(req: OrionRequest): string | undefined {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : undefined;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(SESSIONS) private readonly sessions: SimulatedSessionStore) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<OrionRequest>();
    const token = bearer(req);
    const userId = token ? this.sessions.resolve(token) : undefined;
    if (!token || !userId) throw new DomainError('UNAUTHENTICATED', 'Inicia sesión para continuar.');
    req.userId = userId;
    req.token = token;
    return true;
  }
}

/** Valida sesión y pertenencia al negocio de la ruta en cada operación. */
@Injectable()
export class BusinessGuard implements CanActivate {
  constructor(
    @Inject(SESSIONS) private readonly sessions: SimulatedSessionStore,
    @Inject(CONTAINER) private readonly c: OrionContainer,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<OrionRequest>();
    const token = bearer(req);
    const userId = token ? this.sessions.resolve(token) : undefined;
    if (!userId) throw new DomainError('UNAUTHENTICATED', 'Inicia sesión para continuar.');
    const businessId = req.params['businessId'];
    if (typeof businessId !== 'string') throw new DomainError('NOT_FOUND', 'Negocio no encontrado.');
    req.userId = userId;
    req.actor = await this.c.access.resolveActor(userId, businessId, req.requestId);
    return true;
  }
}
