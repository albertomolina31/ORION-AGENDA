import { z } from 'zod';
import { Id, IsoDateTime, RequestId } from './common.js';
import { AppointmentStatus } from './appointments.js';
import { ConsentEvent, ConsentStatus } from './customers.js';

/**
 * Privacidad y datos (sección 14). Diseño de consentimiento, solicitudes de derechos
 * (acceso, rectificación, cancelación y oposición) y exportación/eliminación.
 * Este plan no sustituye una evaluación legal: los plazos y la política de retención
 * quedan pendientes de revisión especializada y NO se inventan en el código.
 */

/** Registrar consentimiento o baja. Tener teléfono o una cita no equivale a consentimiento. */
export const UpdateConsentRequest = z
  .object({
    requestId: RequestId,
    status: z.enum(['GRANTED', 'REVOKED']),
    source: z.enum(['STAFF_APP', 'CUSTOMER_REQUEST']).default('STAFF_APP'),
    evidence: z.string().trim().max(200).optional(),
  })
  .refine((r) => r.status !== 'GRANTED' || (r.evidence?.length ?? 0) >= 3, {
    message: 'Indica cómo dio su consentimiento (p. ej. "Lo aceptó en mostrador").',
    path: ['evidence'],
  });
export type UpdateConsentRequest = z.input<typeof UpdateConsentRequest>;

// ── Solicitudes de derechos (ARCO) ──

export const PrivacyRequestType = z.enum(['ACCESS', 'RECTIFICATION', 'CANCELLATION', 'OPPOSITION']);
export type PrivacyRequestType = z.infer<typeof PrivacyRequestType>;

export const PRIVACY_REQUEST_TYPE_LABELS: Record<PrivacyRequestType, { title: string; description: string }> = {
  ACCESS: { title: 'Acceso', description: 'Quiere saber qué datos suyos tiene el negocio.' },
  RECTIFICATION: { title: 'Rectificación', description: 'Quiere corregir datos incorrectos.' },
  CANCELLATION: { title: 'Cancelación', description: 'Quiere que se eliminen sus datos.' },
  OPPOSITION: { title: 'Oposición', description: 'No quiere que sus datos se usen para promociones.' },
};

export const PrivacyRequestStatus = z.enum(['RECEIVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED']);
export type PrivacyRequestStatus = z.infer<typeof PrivacyRequestStatus>;

export const PRIVACY_REQUEST_STATUS_LABELS: Record<PrivacyRequestStatus, string> = {
  RECEIVED: 'Recibida',
  IN_PROGRESS: 'En proceso',
  COMPLETED: 'Atendida',
  REJECTED: 'Rechazada',
};

export const PrivacyRequestChannel = z.enum(['IN_PERSON', 'WHATSAPP', 'EMAIL', 'PHONE']);
export type PrivacyRequestChannel = z.infer<typeof PrivacyRequestChannel>;

export const PRIVACY_CHANNEL_LABELS: Record<PrivacyRequestChannel, string> = {
  IN_PERSON: 'En persona',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Correo',
  PHONE: 'Teléfono',
};

export const PrivacyRequestAction = z.enum(['start', 'complete', 'reject']);
export type PrivacyRequestAction = z.infer<typeof PrivacyRequestAction>;

export const PrivacyRequest = z.object({
  id: Id,
  customer: z.object({ id: Id, name: z.string(), anonymized: z.boolean() }),
  type: PrivacyRequestType,
  typeLabel: z.string(),
  status: PrivacyRequestStatus,
  statusLabel: z.string(),
  channel: PrivacyRequestChannel,
  channelLabel: z.string(),
  details: z.string().nullable(),
  receivedAt: IsoDateTime,
  /** Días naturales desde que se recibió. El plazo legal aplicable está pendiente de revisión. */
  daysOpen: z.number().int().nonnegative(),
  resolvedAt: IsoDateTime.nullable(),
  resolution: z.string().nullable(),
  history: z.array(z.object({ at: IsoDateTime, status: PrivacyRequestStatus, statusLabel: z.string(), actorName: z.string(), note: z.string().nullable() })),
  allowedActions: z.array(PrivacyRequestAction),
  /** Qué falta para poder darla por atendida (p. ej. eliminar los datos en una cancelación). */
  completionBlocker: z.string().nullable(),
});
export type PrivacyRequest = z.infer<typeof PrivacyRequest>;

export const CreatePrivacyRequest = z.object({
  requestId: RequestId,
  customerId: Id,
  type: PrivacyRequestType,
  channel: PrivacyRequestChannel,
  details: z.string().trim().max(500).optional(),
});
export type CreatePrivacyRequest = z.input<typeof CreatePrivacyRequest>;

export const PrivacyRequestTransition = z.object({
  requestId: RequestId,
  /** Obligatoria al atender o rechazar: queda como constancia de la respuesta. */
  note: z.string().trim().max(500).optional(),
});
export type PrivacyRequestTransition = z.input<typeof PrivacyRequestTransition>;

export const PrivacyOverview = z.object({
  consent: z.object({ granted: z.number().int(), notGranted: z.number().int(), revoked: z.number().int() }),
  openRequests: z.array(PrivacyRequest),
  closedRequests: z.array(PrivacyRequest),
  recentConsentChanges: z.array(ConsentEvent.extend({ customerId: Id, customerName: z.string() })),
  /** Pendientes de definir con revisión especializada antes del piloto con datos reales. */
  pendingPolicies: z.array(z.string()),
});
export type PrivacyOverview = z.infer<typeof PrivacyOverview>;

/** Exportación de los datos de un cliente (solicitud de acceso). */
export const CustomerDataExport = z.object({
  format: z.literal('orion.customer-export.v1'),
  exportedAt: IsoDateTime,
  exportedBy: z.string(),
  business: z.object({ id: Id, name: z.string() }),
  customer: z.object({
    id: Id,
    name: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    note: z.string().nullable(),
    customerSince: IsoDateTime,
    promotionalConsent: ConsentStatus,
    anonymized: z.boolean(),
  }),
  consentHistory: z.array(ConsentEvent),
  appointments: z.array(
    z.object({
      startsAt: IsoDateTime,
      status: AppointmentStatus,
      serviceName: z.string(),
      professionalName: z.string(),
      price: z.object({ amountMinor: z.number().int(), currency: z.string() }),
    }),
  ),
  privacyRequests: z.array(z.object({ type: PrivacyRequestType, status: PrivacyRequestStatus, receivedAt: IsoDateTime, resolvedAt: IsoDateTime.nullable() })),
});
export type CustomerDataExport = z.infer<typeof CustomerDataExport>;

export const ANONYMIZED_CUSTOMER_NAME = 'Cliente eliminado';

/** Eliminar datos personales: se conservan citas e importes sin identificar a la persona. */
export const AnonymizeCustomerRequest = z.object({
  requestId: RequestId,
  /** Solicitud de cancelación que se atiende con esta eliminación, si existe. */
  privacyRequestId: Id.optional(),
  /** El nombre actual del cliente, escrito por quien confirma (evita eliminar al cliente equivocado). */
  confirmName: z.string().trim().min(1),
});
export type AnonymizeCustomerRequest = z.input<typeof AnonymizeCustomerRequest>;
