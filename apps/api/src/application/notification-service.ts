import type { NotificationItem, NotificationsResponse, NotificationType } from '@orion/contracts';
import type { Clock } from '../domain/clock.js';
import { toLocalTime, toLocalDate } from '../domain/local-time.js';
import type { ActorContext, OutboxEvent } from '../domain/model.js';
import type { Repositories, UnitOfWork } from './ports.js';

const MAX_ITEMS = 50;
const WINDOW_DAYS = 7;

const typeByEvent: Record<string, NotificationType> = {
  'appointment.pending': 'REQUEST_RECEIVED',
  'appointment.expired': 'REQUEST_EXPIRED',
  'appointment.cancelled': 'APPOINTMENT_CANCELLED',
  'appointment.rescheduled': 'APPOINTMENT_RESCHEDULED',
  'appointment.confirmed': 'APPOINTMENT_BOOKED',
};

/**
 * Bandeja de avisos (UI18) derivada de los eventos de dominio del outbox.
 * - No avisa al actor de sus propias acciones.
 * - Respeta permisos: un profesional solo ve avisos de sus citas.
 * - El aviso abre el detalle vigente; nunca habilita acciones con datos viejos.
 */
export class NotificationService {
  constructor(
    private readonly repos: Repositories,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  private async relevant(actor: ActorContext): Promise<OutboxEvent[]> {
    const since = this.clock.now().getTime() - WINDOW_DAYS * 86_400_000;
    return (await this.repos.outbox.all())
      .filter(
        (e) =>
          e.businessId === actor.businessId &&
          typeByEvent[e.eventType] !== undefined &&
          e.actorId !== actor.userId &&
          e.occurredAt.getTime() >= since &&
          // Las confirmaciones solo interesan si llegaron por un canal externo.
          (e.eventType !== 'appointment.confirmed' || e.actorId.startsWith('channel:')) &&
          (actor.permissions.has('agenda.view_all') || (e.payload as { professionalId?: string }).professionalId === actor.professionalId),
      )
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, MAX_ITEMS);
  }

  async list(actor: ActorContext): Promise<NotificationsResponse> {
    const [events, reads, customers, business] = await Promise.all([
      this.relevant(actor),
      this.repos.notificationReads.list(actor.userId, actor.businessId),
      this.repos.customers.list(actor.businessId),
      this.repos.businesses.get(actor.businessId),
    ]);
    const tz = business?.timezone ?? 'UTC';
    const readSet = new Set(reads.map((r) => r.eventId));
    const today = toLocalDate(this.clock.now(), tz);
    const items: NotificationItem[] = events.map((e) => {
      const p = e.payload as { customerId?: string; startsAt?: string; appointmentId?: string };
      const name = customers.find((c) => c.id === p.customerId)?.name ?? 'Un cliente';
      const startsAt = p.startsAt ? new Date(p.startsAt) : null;
      const when = startsAt ? `${toLocalDate(startsAt, tz) === today ? 'hoy' : toLocalDate(startsAt, tz).slice(8) + '/' + toLocalDate(startsAt, tz).slice(5, 7)} a las ${toLocalTime(startsAt, tz)}` : '';
      const type = typeByEvent[e.eventType]!;
      const copy: Record<NotificationType, { title: string; body: string }> = {
        REQUEST_RECEIVED: { title: 'Nueva solicitud por WhatsApp', body: `${name} pidió cita ${when}. Pendiente de aprobación.` },
        REQUEST_EXPIRED: { title: 'Solicitud vencida', body: `La solicitud de ${name} para ${when} venció sin respuesta. El horario quedó libre.` },
        APPOINTMENT_CANCELLED: { title: 'Cita cancelada', body: `${name} · ${when}. El horario quedó libre.` },
        APPOINTMENT_RESCHEDULED: { title: 'Cita reprogramada', body: `${name} ahora tiene cita ${when}.` },
        APPOINTMENT_BOOKED: { title: 'Nueva cita por WhatsApp', body: `${name} reservó ${when}.` },
      };
      return {
        id: e.eventId,
        type,
        ...copy[type],
        at: e.occurredAt.toISOString(),
        appointmentId: p.appointmentId ?? null,
        read: readSet.has(e.eventId),
      };
    });
    return { items, unreadCount: items.filter((i) => !i.read).length };
  }

  async markRead(actor: ActorContext, opts: { ids?: string[]; all?: boolean }): Promise<NotificationsResponse> {
    const events = await this.relevant(actor);
    const ids = opts.all ? events.map((e) => e.eventId) : (opts.ids ?? []).filter((id) => events.some((e) => e.eventId === id));
    await this.uow.run([actor.businessId], () =>
      this.repos.notificationReads.mark(ids.map((eventId) => ({ userId: actor.userId, businessId: actor.businessId, eventId }))),
    );
    return this.list(actor);
  }
}
