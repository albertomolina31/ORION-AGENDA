import type {
  Appointment,
  AppointmentHistoryEntry,
  Business,
  CalendarOccupancy,
  ConsentRecord,
  Customer,
  PrivacyRequestRecord,
  IdempotencyRecord,
  Membership,
  NotificationRead,
  OutboxEvent,
  Professional,
  ProfessionalService,
  ScheduleException,
  Service,
  User,
  WeeklyHours,
} from '../domain/model.js';

/**
 * Puertos de persistencia (sección 25 paso 5). Son contratos de garantías, no
 * implementaciones: la versión PostgreSQL deberá demostrar atomicidad, exclusión
 * de traslapes y durabilidad (D09). Hoy solo existen adaptadores en memoria.
 */

export interface UserReader {
  get(id: string): Promise<User | undefined>;
  list(): Promise<User[]>;
}

export interface MembershipReader {
  listByUser(userId: string): Promise<Membership[]>;
  get(userId: string, businessId: string): Promise<Membership | undefined>;
}

export interface BusinessReader {
  get(id: string): Promise<Business | undefined>;
}

export interface BusinessWriter {
  update(b: Business): Promise<void>;
}

export interface CatalogReader {
  professionals(businessId: string): Promise<Professional[]>;
  services(businessId: string): Promise<Service[]>;
  professionalServices(businessId: string): Promise<ProfessionalService[]>;
}

export interface CatalogWriter {
  upsertService(s: Service): Promise<void>;
  upsertProfessional(p: Professional): Promise<void>;
  /** Reemplaza las asignaciones de un servicio. */
  setServiceProfessionals(businessId: string, serviceId: string, professionalIds: string[]): Promise<void>;
  /** Reemplaza las asignaciones de un profesional. */
  setProfessionalServices(businessId: string, professionalId: string, serviceIds: string[]): Promise<void>;
}

export interface ScheduleWriter {
  setWeekly(hours: WeeklyHours): Promise<void>;
  upsertException(e: ScheduleException): Promise<void>;
  deleteException(businessId: string, id: string): Promise<void>;
}

export interface NotificationReadStore {
  list(userId: string, businessId: string): Promise<NotificationRead[]>;
  mark(reads: NotificationRead[]): Promise<void>;
}

export interface ScheduleReader {
  businessHours(businessId: string): Promise<WeeklyHours>;
  professionalHours(businessId: string): Promise<WeeklyHours[]>;
  exceptions(businessId: string, fromDate: string, toDate: string): Promise<ScheduleException[]>;
}

export interface CustomerRepository {
  list(businessId: string): Promise<Customer[]>;
  get(businessId: string, id: string): Promise<Customer | undefined>;
  insert(customer: Customer): Promise<void>;
  update(customer: Customer): Promise<void>;
}

export interface PrivacyRepository {
  consentHistory(businessId: string, customerId?: string): Promise<ConsentRecord[]>;
  appendConsent(r: ConsentRecord): Promise<void>;
  listRequests(businessId: string): Promise<PrivacyRequestRecord[]>;
  getRequest(businessId: string, id: string): Promise<PrivacyRequestRecord | undefined>;
  saveRequest(r: PrivacyRequestRecord): Promise<void>;
}

export interface AppointmentRepository {
  get(businessId: string, id: string): Promise<Appointment | undefined>;
  listOverlapping(businessId: string, from: Date, to: Date): Promise<Appointment[]>;
  listByCustomer(businessId: string, customerId: string): Promise<Appointment[]>;
  listAll(businessId: string): Promise<Appointment[]>;
  listExpiredPending(now: Date): Promise<Appointment[]>;
  insert(appt: Appointment): Promise<void>;
  /** Actualización condicionada a la versión esperada (control optimista). */
  update(appt: Appointment, expectedVersion: number): Promise<void>;
}

export interface OccupancyRepository {
  listActive(businessId: string, professionalIds: string[], from: Date, to: Date): Promise<CalendarOccupancy[]>;
  /** Debe rechazar traslapes activos del mismo profesional (restricción de exclusión). */
  insert(o: CalendarOccupancy): Promise<void>;
  deactivateForAppointment(businessId: string, appointmentId: string): Promise<void>;
  listBlocks(businessId: string, from: Date, to: Date): Promise<CalendarOccupancy[]>;
  getBlock(businessId: string, id: string): Promise<CalendarOccupancy | undefined>;
  deactivate(businessId: string, id: string): Promise<void>;
}

export interface HistoryRepository {
  append(e: AppointmentHistoryEntry): Promise<void>;
  listForAppointment(businessId: string, appointmentId: string): Promise<AppointmentHistoryEntry[]>;
}

export interface Outbox {
  append(e: OutboxEvent): Promise<void>;
  listPending(limit: number): Promise<OutboxEvent[]>;
  mark(eventId: string, status: OutboxEvent['status']): Promise<void>;
  all(): Promise<OutboxEvent[]>;
}

export interface IdempotencyStore {
  get(scope: string): Promise<IdempotencyRecord | undefined>;
  put(r: IdempotencyRecord): Promise<void>;
  findByRequestId(actorId: string, requestId: string): Promise<IdempotencyRecord | undefined>;
}

export interface Repositories {
  users: UserReader;
  memberships: MembershipReader;
  businesses: BusinessReader;
  businessWriter: BusinessWriter;
  catalog: CatalogReader;
  catalogWriter: CatalogWriter;
  schedules: ScheduleReader;
  scheduleWriter: ScheduleWriter;
  notificationReads: NotificationReadStore;
  customers: CustomerRepository;
  privacy: PrivacyRepository;
  appointments: AppointmentRepository;
  occupancies: OccupancyRepository;
  history: HistoryRepository;
  outbox: Outbox;
  idempotency: IdempotencyStore;
}

/**
 * Ejecuta un bloque como unidad atómica sobre los ámbitos indicados (negocios),
 * bloqueándolos en orden estable. Si el bloque falla, no queda ningún cambio.
 */
export interface UnitOfWork {
  run<T>(scopes: string[], fn: () => Promise<T>): Promise<T>;
}

export const REPOSITORIES = Symbol('REPOSITORIES');
export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
export const CLOCK = Symbol('CLOCK');
export const ID_GENERATOR = Symbol('ID_GENERATOR');
