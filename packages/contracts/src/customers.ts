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
