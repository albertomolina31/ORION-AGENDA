import type { OutboxEvent } from '../domain/model.js';
import type { Repositories } from './ports.js';

export type EventConsumer = (event: OutboxEvent) => Promise<void>;

/**
 * Worker simulado del outbox: entrega al menos una vez a los consumidores registrados.
 * El envío por WhatsApp (Carlos) se conectará aquí como otro consumidor.
 */
export class OutboxDispatcher {
  private consumers: EventConsumer[] = [];
  constructor(private readonly repos: Repositories) {}

  register(consumer: EventConsumer): void {
    this.consumers.push(consumer);
  }

  async dispatchPending(limit = 100): Promise<number> {
    const pending = await this.repos.outbox.listPending(limit);
    for (const event of pending) {
      try {
        for (const c of this.consumers) await c(event);
        await this.repos.outbox.mark(event.eventId, 'DISPATCHED');
      } catch {
        await this.repos.outbox.mark(event.eventId, event.attempts >= 4 ? 'FAILED' : 'PENDING');
      }
    }
    return pending.length;
  }
}
