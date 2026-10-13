import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { ErrorEnvelope } from '@orion/contracts';
import type { Response } from 'express';
import { ZodError } from 'zod';
import { DomainError, httpStatusFor } from '../domain/errors.js';
import type { OrionRequest } from './request-context.js';
import { fieldErrorsOf } from './zod-pipe.js';

/** Envelope estable: code, message, fieldErrors opcional y requestId. Sin trazas internas. */
@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<OrionRequest>();
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let body: ErrorEnvelope = { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.', requestId: req.requestId };

    if (exception instanceof DomainError) {
      status = httpStatusFor[exception.code];
      body = {
        code: exception.code,
        message: exception.message,
        requestId: req.requestId,
        ...(exception.fieldErrors ? { fieldErrors: exception.fieldErrors } : {}),
        ...(exception.details ? { details: exception.details } : {}),
      };
    } else if (exception instanceof ZodError) {
      status = 400;
      body = { code: 'VALIDATION_ERROR', message: 'Revisa los datos enviados.', fieldErrors: fieldErrorsOf(exception), requestId: req.requestId };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      body = {
        code: status === 404 ? 'NOT_FOUND' : status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message: status === 404 ? 'Recurso no encontrado.' : 'Solicitud no válida.',
        requestId: req.requestId,
      };
    } else {
      // Logs con requestId y businessId; sin tokens ni datos personales.
      this.logger.error(`[${req.requestId}] ${req.method} ${req.route?.path ?? ''} business=${req.actor?.businessId ?? '-'}`, (exception as Error)?.stack);
    }
    res.status(status).json(body);
  }
}
