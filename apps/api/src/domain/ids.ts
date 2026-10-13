import { randomUUID } from 'node:crypto';

export interface IdGenerator {
  next(prefix: string): string;
}

export class RandomIdGenerator implements IdGenerator {
  next(prefix: string): string {
    return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
}

/** Determinista para pruebas y fixtures. */
export class SequentialIdGenerator implements IdGenerator {
  private n = 0;
  next(prefix: string): string {
    this.n += 1;
    return `${prefix}_${String(this.n).padStart(4, '0')}`;
  }
}
