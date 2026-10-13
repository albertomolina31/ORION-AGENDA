import { type PipeTransform } from '@nestjs/common';
import { type ZodType, ZodError } from 'zod';
import { DomainError } from '../domain/errors.js';

export function fieldErrorsOf(err: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Validación en servidor con los mismos esquemas que usa la app (contracts). */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const r = this.schema.safeParse(value);
    if (!r.success) {
      throw new DomainError('VALIDATION_ERROR', 'Revisa los datos enviados.', undefined, fieldErrorsOf(r.error));
    }
    return r.data;
  }
}
