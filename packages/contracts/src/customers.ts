import { z } from 'zod';
import { Id, IsoDateTime } from './common.js';
import { AppointmentStatus } from './appointments.js';

export const CustomerSegment = z.enum(['ALL', 'WITH_UPCOMING', 'NO_UPCOMING', 'FIRST_VISIT', 'REGULARS']);
export type CustomerSegment = z.infer<typeof CustomerSegment>;

export const UpcomingAppointmentRef = z.object({
  appointmentId: Id,
  startsAt: IsoDateTime,
  status: AppointmentStatus,
  serviceName: z.string(),
  professionalName: z.string(),
});

export const CustomerSummary = z.object({
  id: Id,
  name: z.string(),
  initials: z.string(),
  phoneMasked: z.string().nullable(),
  lastVisitAt: IsoDateTime.nullable(),
  completedVisits: z.number().int().nonnegative(),
  nextAppointment: UpcomingAppointmentRef.nullable(),
  /** Necesario para elegir destinatarios de campañas; no equivale a permiso de envío. */
  promotionalConsent: z.enum(['GRANTED', 'NOT_GRANTED', 'REVOKED']),
});
export type CustomerSummary = z.infer<typeof CustomerSummary>;

export const CustomerListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  segment: CustomerSegment.default('ALL'),
  sort: z.enum(['NAME', 'NEXT_APPOINTMENT', 'LAST_VISIT']).default('NAME'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type CustomerListQuery = z.input<typeof CustomerListQuery>;

export const CustomerListResponse = z.object({
  items: z.array(CustomerSummary),
  total: z.number().int(),
  nextCursor: z.string().nullable(),
  segmentCounts: z.record(CustomerSegment, z.number().int()),
});
export type CustomerListResponse = z.infer<typeof CustomerListResponse>;

export const ConsentStatus = z.enum(['GRANTED', 'NOT_GRANTED', 'REVOKED']);
export type ConsentStatus = z.infer<typeof ConsentStatus>;

export const ConsentSource = z.enum(['STAFF_APP', 'WHATSAPP', 'CUSTOMER_REQUEST', 'SYSTEM']);
export type ConsentSource = z.infer<typeof ConsentSource>;

export const CONSENT_SOURCE_LABELS: Record<ConsentSource, string> = {
  STAFF_APP: 'Registrado por el equipo',
  WHATSAPP: 'Por WhatsApp',
  CUSTOMER_REQUEST: 'Solicitud del cliente',
  SYSTEM: 'Automático',
};

export const CONSENT_STATUS_LABELS: Record<ConsentStatus, string> = {
  GRANTED: 'Acepta promociones',
  NOT_GRANTED: 'Sin permiso',
  REVOKED: 'Se dio de baja',
};

export const ConsentEvent = z.object({
  id: Id,
  at: IsoDateTime,
  status: ConsentStatus,
  statusLabel: z.string(),
  source: ConsentSource,
  sourceLabel: z.string(),
  actorName: z.string(),
  /** Cómo se obtuvo (p. ej. "Lo aceptó en mostrador"). Obligatorio al otorgar. */
  evidence: z.string().nullable(),
});
export type ConsentEvent = z.infer<typeof ConsentEvent>;


export const CustomerDetail = CustomerSummary.extend({
  phone: z.string().nullable(),
  email: z.string().nullable(),
  customerSince: IsoDateTime,
  preferredProfessional: z.object({ id: Id, name: z.string() }).nullable(),
  /** Nota operativa breve. No incluir datos clínicos (sección 14). */
  note: z.string().nullable(),
  promotionalConsent: ConsentStatus,
  history: z.array(
    z.object({
      appointmentId: Id,
      startsAt: IsoDateTime,
      status: AppointmentStatus,
      serviceName: z.string(),
      professionalName: z.string(),
    }),
  ),
  possibleDuplicates: z.array(z.object({ id: Id, name: z.string() })),
  /** Historial de consentimiento promocional (más reciente primero). Solo con customers.view_all. */
  consentHistory: z.array(ConsentEvent),
  /** Datos personales eliminados por solicitud; se conservan citas sin identificar a la persona. */
  anonymized: z.boolean(),
  /** Notas internas que este usuario puede ver (según su rol). */
  notes: z.array(z.lazy(() => CustomerNote)),
});
export type CustomerDetail = z.infer<typeof CustomerDetail>;

export const CreateCustomerRequest = z.object({
  requestId: z.string().min(8).max(64),
  name: z.string().trim().min(2, 'Escribe al menos 2 caracteres').max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{8,20}$/, 'Teléfono no válido')
    .optional(),
  email: z.email('Correo no válido').optional(),
  note: z.string().trim().max(140).optional(),
  promotionalConsent: z.boolean().default(false),
});
export type CreateCustomerRequest = z.input<typeof CreateCustomerRequest>;

// ── Edición de la ficha (UI11) ──

export const PhoneInput = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{8,20}$/, 'Teléfono no válido');

/** Corrige datos de contacto y preferencias. El consentimiento se cambia aparte, con constancia. */
export const UpdateCustomerRequest = z.object({
  requestId: z.string().min(8).max(64),
  name: z.string().trim().min(2, 'Escribe al menos 2 caracteres').max(80),
  phone: PhoneInput.nullable(),
  email: z.email('Correo no válido').nullable(),
  /** Nota operativa breve visible en la ficha. Sin datos clínicos. */
  note: z.string().trim().max(140).nullable(),
  preferredProfessionalId: Id.nullable(),
});
export type UpdateCustomerRequest = z.input<typeof UpdateCustomerRequest>;

// ── Notas internas por rol ──

export const CustomerNoteVisibility = z.enum(['TEAM', 'ADMINS']);
export type CustomerNoteVisibility = z.infer<typeof CustomerNoteVisibility>;

export const CUSTOMER_NOTE_VISIBILITY_LABELS: Record<CustomerNoteVisibility, { title: string; description: string }> = {
  TEAM: { title: 'Todo el equipo', description: 'La ve quien tenga acceso a la ficha, incluido el profesional que atiende.' },
  ADMINS: { title: 'Solo dueño y administración', description: 'Para temas sensibles del negocio (pagos, incidencias). Sin datos clínicos.' },
};

export const CustomerNote = z.object({
  id: Id,
  body: z.string(),
  visibility: CustomerNoteVisibility,
  visibilityLabel: z.string(),
  authorName: z.string(),
  createdAt: IsoDateTime,
  /** El autor o la administración pueden borrarla. */
  canDelete: z.boolean(),
});
export type CustomerNote = z.infer<typeof CustomerNote>;

export const CreateCustomerNoteRequest = z.object({
  requestId: z.string().min(8).max(64),
  body: z.string().trim().min(2, 'Escribe la nota').max(500, 'Máximo 500 caracteres'),
  visibility: CustomerNoteVisibility.default('TEAM'),
});
export type CreateCustomerNoteRequest = z.input<typeof CreateCustomerNoteRequest>;

// ── Unir duplicados (nunca automático) ──

export const MergePreview = z.object({
  survivor: z.object({ id: Id, name: z.string(), phoneMasked: z.string().nullable(), completedVisits: z.number().int() }),
  duplicate: z.object({ id: Id, name: z.string(), phoneMasked: z.string().nullable(), completedVisits: z.number().int() }),
  appointmentsToMove: z.number().int(),
  notesToMove: z.number().int(),
  /** Campos vacíos del cliente que se conserva que se completarán con el duplicado. */
  fieldsFilled: z.array(z.string()),
  consentResult: ConsentStatus,
  consentExplanation: z.string(),
  loyalty: z.enum(['NONE', 'MOVE', 'BLOCKED']),
  /** Si hay algo que impide unir (p. ej. ambos con tarjeta de fidelidad). */
  blockedReason: z.string().nullable(),
});
export type MergePreview = z.infer<typeof MergePreview>;

export const MergeCustomersRequest = z.object({
  requestId: z.string().min(8).max(64),
  duplicateId: Id,
});
export type MergeCustomersRequest = z.input<typeof MergeCustomersRequest>;
