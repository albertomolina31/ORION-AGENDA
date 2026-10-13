import { z } from 'zod';
import { Id, IsoDateTime } from './common.js';

/** Bandeja operativa (UI18). Derivada de eventos de dominio; no sustituye recargar el detalle. */
export const NotificationType = z.enum([
  'REQUEST_RECEIVED',
  'REQUEST_EXPIRED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_RESCHEDULED',
  'APPOINTMENT_BOOKED',
]);
export type NotificationType = z.infer<typeof NotificationType>;

export const NotificationItem = z.object({
  id: Id,
  type: NotificationType,
  title: z.string(),
  body: z.string(),
  at: IsoDateTime,
  appointmentId: Id.nullable(),
  read: z.boolean(),
});
export type NotificationItem = z.infer<typeof NotificationItem>;

export const NotificationsResponse = z.object({
  items: z.array(NotificationItem),
  unreadCount: z.number().int(),
});
export type NotificationsResponse = z.infer<typeof NotificationsResponse>;

export const MarkNotificationsRequest = z.object({
  ids: z.array(Id).max(200).optional(),
  all: z.boolean().optional(),
});
export type MarkNotificationsRequest = z.infer<typeof MarkNotificationsRequest>;
