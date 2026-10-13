import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ActorContext } from '../domain/model.js';

export interface OrionRequest extends Request {
  requestId: string;
  userId?: string;
  actor?: ActorContext;
  token?: string;
}

export const Actor = createParamDecorator((_: unknown, ctx: ExecutionContext): ActorContext => {
  const req = ctx.switchToHttp().getRequest<OrionRequest>();
  if (!req.actor) throw new Error('BusinessGuard missing on route');
  return req.actor;
});

export const UserId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<OrionRequest>();
  if (!req.userId) throw new Error('AuthGuard missing on route');
  return req.userId;
});
