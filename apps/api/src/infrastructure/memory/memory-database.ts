import type { UnitOfWork, Repositories } from '../../application/ports.js';
import { DomainError } from '../../domain/errors.js';
import { overlaps } from '../../domain/interval.js';
import type {
  Appointment,
  AppointmentHistoryEntry,
  Business,
  CalendarOccupancy,
  Customer,
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
} from '../../domain/model.js';

/**
 * ⚠️ SIMULACIÓN. Base de datos en memoria para desarrollo y pruebas (sección 25 paso 6).
 * Se reinicia con cada arranque, usa solo datos sintéticos y NO demuestra persistencia,
 * seguridad de producción ni exclusión concurrente real entre procesos.
 */
export interface MemoryState {
  users: User[];
  memberships: Membership[];
  businesses: Business[];
  professionals: Professional[];
  services: Service[];
  professionalServices: ProfessionalService[];
  weeklyHours: WeeklyHours[];
  exceptions: ScheduleException[];
  customers: Customer[];
  appointments: Appointment[];
  occupancies: CalendarOccupancy[];
  history: AppointmentHistoryEntry[];
  outbox: OutboxEvent[];
  idempotency: IdempotencyRecord[];
  notificationReads: NotificationRead[];
}

export function emptyState(): MemoryState {
  return {
    users: [],
    memberships: [],
    businesses: [],
    professionals: [],
    services: [],
    professionalServices: [],
    weeklyHours: [],
    exceptions: [],
    customers: [],
    appointments: [],
    occupancies: [],
    history: [],
    outbox: [],
    idempotency: [],
    notificationReads: [],
  };
}

const clone = <T>(v: T): T => structuredClone(v);

export class MemoryDatabase implements UnitOfWork {
  state: MemoryState;
  private locks = new Map<string, Promise<void>>();

  constructor(initial: MemoryState = emptyState()) {
    this.state = initial;
  }

  /**
   * Simula la transacción con snapshot/rollback. Como el rollback restaura el estado
   * completo, la simulación serializa TODAS las operaciones con un único candado
   * global (los ámbitos se aceptan para mantener el contrato del puerto).
   */
  async run<T>(_scopes: string[], fn: () => Promise<T>): Promise<T> {
    const ordered = ['*'];
    const releases: Array<() => void> = [];
    for (const scope of ordered) {
      const previous = this.locks.get(scope) ?? Promise.resolve();
      let release!: () => void;
      const current = new Promise<void>((r) => (release = r));
      const chained = previous.then(() => current);
      this.locks.set(scope, chained);
      await previous;
      releases.push(() => {
        release();
        if (this.locks.get(scope) === chained) this.locks.delete(scope);
      });
    }
    const snapshot = clone(this.state);
    try {
      return await fn();
    } catch (err) {
      this.state = snapshot;
      throw err;
    } finally {
      releases.reverse().forEach((r) => r());
    }
  }

  repositories(): Repositories {
    const db = this;
    const s = () => db.state;
    return {
      users: {
        get: async (id) => clone(s().users.find((u) => u.id === id)),
        list: async () => clone(s().users),
      },
      memberships: {
        listByUser: async (userId) => clone(s().memberships.filter((m) => m.userId === userId)),
        get: async (userId, businessId) =>
          clone(s().memberships.find((m) => m.userId === userId && m.businessId === businessId)),
      },
      businesses: {
        get: async (id) => clone(s().businesses.find((b) => b.id === id)),
      },
      catalog: {
        professionals: async (bid) => clone(s().professionals.filter((p) => p.businessId === bid)),
        services: async (bid) => clone(s().services.filter((x) => x.businessId === bid)),
        professionalServices: async (bid) => clone(s().professionalServices.filter((x) => x.businessId === bid)),
      },
      catalogWriter: {
        upsertService: async (svc) => {
          const i = s().services.findIndex((x) => x.businessId === svc.businessId && x.id === svc.id);
          if (i >= 0) s().services[i] = clone(svc);
          else s().services.push(clone(svc));
        },
        upsertProfessional: async (p) => {
          const i = s().professionals.findIndex((x) => x.businessId === p.businessId && x.id === p.id);
          if (i >= 0) s().professionals[i] = clone(p);
          else s().professionals.push(clone(p));
        },
        setServiceProfessionals: async (bid, serviceId, proIds) => {
          s().professionalServices = s().professionalServices.filter((l) => !(l.businessId === bid && l.serviceId === serviceId));
          proIds.forEach((professionalId) => s().professionalServices.push({ businessId: bid, serviceId, professionalId }));
        },
        setProfessionalServices: async (bid, professionalId, serviceIds) => {
          s().professionalServices = s().professionalServices.filter((l) => !(l.businessId === bid && l.professionalId === professionalId));
          serviceIds.forEach((serviceId) => s().professionalServices.push({ businessId: bid, serviceId, professionalId }));
        },
      },
      scheduleWriter: {
        setWeekly: async (h) => {
          s().weeklyHours = s().weeklyHours.filter((x) => !(x.businessId === h.businessId && x.professionalId === h.professionalId));
          s().weeklyHours.push(clone(h));
        },
        upsertException: async (e) => {
          const i = s().exceptions.findIndex((x) => x.businessId === e.businessId && x.id === e.id);
          if (i >= 0) s().exceptions[i] = clone(e);
          else s().exceptions.push(clone(e));
        },
        deleteException: async (bid, id) => {
          s().exceptions = s().exceptions.filter((x) => !(x.businessId === bid && x.id === id));
        },
      },
      notificationReads: {
        list: async (userId, bid) => clone(s().notificationReads.filter((r) => r.userId === userId && r.businessId === bid)),
        mark: async (reads) => {
          for (const r of reads) {
            if (!s().notificationReads.some((x) => x.userId === r.userId && x.businessId === r.businessId && x.eventId === r.eventId)) {
              s().notificationReads.push(clone(r));
            }
          }
        },
      },
      schedules: {
        businessHours: async (bid) =>
          clone(s().weeklyHours.find((h) => h.businessId === bid && h.professionalId === null)) ?? {
            businessId: bid,
            professionalId: null,
            days: {},
          },
        professionalHours: async (bid) =>
          clone(s().weeklyHours.filter((h) => h.businessId === bid && h.professionalId !== null)),
        exceptions: async (bid, from, to) =>
          clone(s().exceptions.filter((e) => e.businessId === bid && e.date >= from && e.date <= to)),
      },
      customers: {
        list: async (bid) => clone(s().customers.filter((c) => c.businessId === bid)),
        get: async (bid, id) => clone(s().customers.find((c) => c.businessId === bid && c.id === id)),
        insert: async (c) => {
          if (s().customers.some((x) => x.id === c.id)) throw new Error(`Duplicate customer id ${c.id}`);
          s().customers.push(clone(c));
        },
      },
      appointments: {
        get: async (bid, id) => clone(s().appointments.find((a) => a.businessId === bid && a.id === id)),
        listOverlapping: async (bid, from, to) =>
          clone(
            s().appointments.filter(
              (a) =>
                a.businessId === bid &&
                overlaps(
                  { start: a.startsAt.getTime(), end: a.endsAt.getTime() },
                  { start: from.getTime(), end: to.getTime() },
                ),
            ),
          ),
        listByCustomer: async (bid, cid) =>
          clone(s().appointments.filter((a) => a.businessId === bid && a.customerId === cid)),
        listAll: async (bid) => clone(s().appointments.filter((a) => a.businessId === bid)),
        listExpiredPending: async (now) =>
          clone(
            s().appointments.filter(
              (a) => a.status === 'PENDING_APPROVAL' && a.expiresAt !== null && a.expiresAt.getTime() <= now.getTime(),
            ),
          ),
        insert: async (a) => {
          if (s().appointments.some((x) => x.id === a.id)) throw new Error(`Duplicate appointment id ${a.id}`);
          s().appointments.push(clone(a));
        },
        update: async (a, expectedVersion) => {
          const idx = s().appointments.findIndex((x) => x.businessId === a.businessId && x.id === a.id);
          const current = s().appointments[idx];
          if (!current) throw new DomainError('NOT_FOUND', 'Cita no encontrada.');
          if (current.version !== expectedVersion) {
            throw new DomainError('STALE_VERSION', 'La cita cambió mientras estaba abierta. Recarga para continuar.', {
              currentVersion: current.version,
            });
          }
          s().appointments[idx] = clone(a);
        },
      },
      occupancies: {
        listActive: async (bid, pids, from, to) =>
          clone(
            s().occupancies.filter(
              (o) =>
                o.businessId === bid &&
                o.active &&
                pids.includes(o.professionalId) &&
                overlaps({ start: o.start.getTime(), end: o.end.getTime() }, { start: from.getTime(), end: to.getTime() }),
            ),
          ),
        insert: async (o) => {
          // Equivalente simulado de EXCLUDE USING gist (professional_id WITH =, tstzrange WITH &&) WHERE active.
          const clash = s().occupancies.some(
            (x) =>
              x.active &&
              x.businessId === o.businessId &&
              x.professionalId === o.professionalId &&
              overlaps({ start: x.start.getTime(), end: x.end.getTime() }, { start: o.start.getTime(), end: o.end.getTime() }),
          );
          if (clash) throw new DomainError('SLOT_UNAVAILABLE', 'El horario ya no está disponible.');
          s().occupancies.push(clone(o));
        },
        deactivateForAppointment: async (bid, apptId) => {
          s().occupancies.forEach((o) => {
            if (o.businessId === bid && o.appointmentId === apptId) o.active = false;
          });
        },
        listBlocks: async (bid, from, to) =>
          clone(
            s().occupancies.filter(
              (o) =>
                o.businessId === bid &&
                o.kind === 'BLOCK' &&
                o.active &&
                overlaps({ start: o.start.getTime(), end: o.end.getTime() }, { start: from.getTime(), end: to.getTime() }),
            ),
          ),
        getBlock: async (bid, id) => clone(s().occupancies.find((o) => o.businessId === bid && o.id === id && o.kind === 'BLOCK')),
        deactivate: async (bid, id) => {
          s().occupancies.forEach((o) => {
            if (o.businessId === bid && o.id === id) o.active = false;
          });
        },
      },
      history: {
        append: async (e) => {
          s().history.push(clone(e));
        },
        listForAppointment: async (bid, id) =>
          clone(s().history.filter((h) => h.businessId === bid && h.appointmentId === id)),
      },
      outbox: {
        append: async (e) => {
          s().outbox.push(clone(e));
        },
        listPending: async (limit) => clone(s().outbox.filter((e) => e.status === 'PENDING').slice(0, limit)),
        mark: async (id, status) => {
          const e = s().outbox.find((x) => x.eventId === id);
          if (e) {
            e.status = status;
            e.attempts += 1;
          }
        },
        all: async () => clone(s().outbox),
      },
      idempotency: {
        get: async (scope) => clone(s().idempotency.find((r) => r.scope === scope)),
        put: async (r) => {
          s().idempotency = s().idempotency.filter((x) => x.scope !== r.scope);
          s().idempotency.push(clone(r));
        },
        findByRequestId: async (actorId, requestId) =>
          clone(s().idempotency.find((r) => r.scope.startsWith(`${actorId}|`) && r.scope.endsWith(`|${requestId}`))),
      },
    };
  }
}
