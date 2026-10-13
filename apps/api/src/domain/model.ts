import type {
  AppointmentSource,
  AppointmentStatus,
  BookingPolicy,
  BusinessCategory,
  ConsentStatus,
  Permission,
  Role,
} from '@orion/contracts';

/**
 * Modelo conceptual (sección 7). NO es un esquema físico: sin decoradores de ORM ni
 * detalles de tablas. La persistencia real queda pendiente de D09.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  active: boolean;
}

export interface Business {
  id: string;
  name: string;
  category: BusinessCategory;
  timezone: string;
  currency: string;
  status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED';
  acceptingExternalBookings: boolean;
  /** Política vigente (la última de `policyHistory`). */
  policy: BookingPolicy;
  /** Todas las versiones; las citas guardan la versión con la que se reservaron. */
  policyHistory: Array<{ policy: BookingPolicy; changedAt: Date; changedBy: string }>;
  integrations: {
    whatsapp: 'CONNECTED' | 'NOT_CONNECTED' | 'ERROR';
    appleWallet: 'CONNECTED' | 'NOT_CONNECTED' | 'ERROR';
    googleWallet: 'CONNECTED' | 'NOT_CONNECTED' | 'ERROR';
  };
  features: { loyalty: boolean; campaigns: boolean };
}

export interface Membership {
  userId: string;
  businessId: string;
  role: Role;
  /** Permisos explícitos adicionales/retirados sobre la base del rol. */
  grants: Permission[];
  revokes: Permission[];
  professionalId: string | null;
  active: boolean;
}

export interface Professional {
  id: string;
  businessId: string;
  name: string;
  colorKey: string;
  userId: string | null;
  active: boolean;
}

export interface Service {
  id: string;
  businessId: string;
  name: string;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  priceMinor: number;
  currency: string;
  active: boolean;
}

export interface ProfessionalService {
  businessId: string;
  professionalId: string;
  serviceId: string;
}

/** Intervalos locales "HH:mm" por día ISO (1 = lunes). Un descanso divide la jornada. */
export interface WeeklyHours {
  businessId: string;
  /** null = horario del negocio. */
  professionalId: string | null;
  days: Record<number, Array<{ start: string; end: string }>>;
}

export interface ScheduleException {
  id: string;
  businessId: string;
  professionalId: string | null;
  /** Fecha local AAAA-MM-DD. */
  date: string;
  /** closed = cierre explícito; si no, intervalos especiales que sustituyen la jornada. */
  closed: boolean;
  intervals: Array<{ start: string; end: string }>;
  reason: string | null;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phoneE164: string | null;
  email: string | null;
  note: string | null;
  preferredProfessionalId: string | null;
  promotionalConsent: ConsentStatus;
  createdAt: Date;
}

export interface Appointment {
  id: string;
  businessId: string;
  customerId: string;
  professionalId: string;
  serviceId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  source: AppointmentSource;
  expiresAt: Date | null;
  version: number;
  /** Snapshot de condiciones aplicadas al reservar. */
  snapshot: {
    serviceName: string;
    durationMin: number;
    bufferBeforeMin: number;
    bufferAfterMin: number;
    priceMinor: number;
    currency: string;
    policyVersion: number;
  };
  customerNotice: 'NOT_APPLICABLE' | 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  createdAt: Date;
  createdBy: string;
}

export type OccupancyKind = 'APPOINTMENT' | 'BLOCK';

/** Ocupación del calendario. Citas y bloqueos comparten la misma protección. */
export interface CalendarOccupancy {
  id: string;
  businessId: string;
  professionalId: string;
  /** Intervalo incluyendo buffers. */
  start: Date;
  end: Date;
  kind: OccupancyKind;
  appointmentId: string | null;
  active: boolean;
  label: string | null;
}

export interface AppointmentHistoryEntry {
  appointmentId: string;
  businessId: string;
  at: Date;
  fromStatus: AppointmentStatus | null;
  toStatus: AppointmentStatus;
  action: string;
  actorId: string;
  actorName: string;
  reason: string | null;
  /** Para reprogramaciones: horario anterior. */
  previousStartsAt: Date | null;
}

export interface OutboxEvent {
  eventId: string;
  eventType: string;
  schemaVersion: number;
  occurredAt: Date;
  businessId: string;
  aggregateId: string;
  aggregateVersion: number;
  correlationId: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'DISPATCHED' | 'FAILED';
  attempts: number;
  /** Quién originó el cambio (usuario, canal o 'system'). Uso interno: no viaja a consumidores externos. */
  actorId: string;
}

export interface NotificationRead {
  userId: string;
  businessId: string;
  eventId: string;
}

export interface IdempotencyRecord {
  scope: string;
  requestHash: string;
  httpStatus: number;
  body: unknown;
  createdAt: Date;
  expiresAt: Date;
}

/** Contexto del actor resuelto por el servidor en cada petición. */
export interface ActorContext {
  userId: string;
  userName: string;
  businessId: string;
  role: Role;
  permissions: ReadonlySet<Permission>;
  professionalId: string | null;
  channel: 'STAFF_APP';
  correlationId: string;
}
