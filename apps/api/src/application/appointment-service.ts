import type {
  AgendaQuery,
  AgendaResponse,
  Appointment as AppointmentDto,
  AppointmentAction,
  AppointmentDetail,
  AvailabilityQuery,
  AvailabilityResponse,
  CreateAppointmentRequest,
  RescheduleRequest,
  TransitionRequest,
} from '@orion/contracts';
import { type AvailabilityInput, checkSlot, computeAvailability, pickProfessional, requiredInterval } from '../domain/availability.js';
import type { Clock } from '../domain/clock.js';
import { DomainError } from '../domain/errors.js';
import type { IdGenerator } from '../domain/ids.js';
import { MINUTE } from '../domain/interval.js';
import { ACTIVE_STATUSES, actionsAllowedByState, decideTransition, isExpired } from '../domain/lifecycle.js';
import { addDaysLocal, localDayBounds, toLocalDate, toLocalTime, toZonedIso } from '../domain/local-time.js';
import type { ActorContext, Appointment, Business, Customer, Professional, Service } from '../domain/model.js';
import { canActOn, canCreateFor, canViewProfessionalAgenda } from '../domain/permissions.js';
import type { IdempotencyService } from './idempotency-service.js';
import type { Repositories, UnitOfWork } from './ports.js';
import { initials } from './presentation.js';

const MAX_AGENDA_DAYS = 31;

/** Política con la que se reservó la cita (L17); si no existe, la vigente. */
export function policyFor(business: Business, version: number) {
  return business.policyHistory.find((h) => h.policy.version === version)?.policy ?? business.policy;
}
const SYSTEM_ACTOR = { id: 'system', name: 'Sistema' };

interface Lookups {
  business: Business;
  professionals: Map<string, Professional>;
  services: Map<string, Service>;
  customers: Map<string, Customer>;
  completedByCustomer: Map<string, number>;
}

/** Casos de uso del ciclo de citas (L06–L11). App y bot consumen el mismo comportamiento. */
export class AppointmentService {
  constructor(
    private readonly repos: Repositories,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly idempotency: IdempotencyService,
  ) {}

  // ───────────────────────── Lecturas ─────────────────────────

  async availability(actor: ActorContext, q: AvailabilityQuery): Promise<AvailabilityResponse> {
    if (!canCreateFor(actor, q.professionalId ?? null)) {
      throw new DomainError('FORBIDDEN', 'No tienes permiso para consultar horarios de reserva.');
    }
    const business = await this.business(actor.businessId);
    const input = await this.availabilityInput(business, q.serviceId, q.date, q.excludeAppointmentId);
    if (q.professionalId && !input.professionals.some((p) => p.id === q.professionalId)) {
      throw new DomainError('NOT_FOUND', 'Profesional no encontrado.');
    }
    const day = computeAvailability(input, q.professionalId);
    // "Cualquiera": combinar opciones sin duplicados visuales.
    const grouped = new Map<number, { end: number; ids: string[] }>();
    for (const s of day.slots) {
      const g = grouped.get(s.start);
      if (g) g.ids.push(s.professionalId);
      else grouped.set(s.start, { end: s.end, ids: [s.professionalId] });
    }
    return {
      timezone: business.timezone,
      date: q.date,
      serviceId: q.serviceId,
      slots: [...grouped.entries()].map(([start, g]) => ({
        startsAt: toZonedIso(start, business.timezone),
        endsAt: toZonedIso(g.end, business.timezone),
        localTime: toLocalTime(start, business.timezone),
        professionalIds: g.ids,
      })),
      calculatedAt: this.clock.now().toISOString(),
      closedReason: day.closedReason,
    };
  }

  async agenda(actor: ActorContext, q: AgendaQuery): Promise<AgendaResponse> {
    const business = await this.business(actor.businessId);
    const tz = business.timezone;
    const to = q.to ?? q.from;
    if (to < q.from) throw new DomainError('VALIDATION_ERROR', 'Rango de fechas inválido.');
    const days = Math.round((localDayBounds(to, tz).start - localDayBounds(q.from, tz).start) / (24 * 60 * MINUTE)) + 1;
    if (days > MAX_AGENDA_DAYS) throw new DomainError('VALIDATION_ERROR', `El rango máximo de agenda es ${MAX_AGENDA_DAYS} días.`);

    // Permisos antes de devolver resultados, no después en la app (L13).
    let professionalId = q.professionalId;
    if (!actor.permissions.has('agenda.view_all')) {
      if (!actor.professionalId) throw new DomainError('FORBIDDEN', 'No tienes una agenda asignada.');
      if (professionalId && professionalId !== actor.professionalId) {
        throw new DomainError('FORBIDDEN', 'Solo puedes ver tu propia agenda.');
      }
      professionalId = actor.professionalId;
    }

    const range = { start: localDayBounds(q.from, tz).start, end: localDayBounds(to, tz).end };
    let list = await this.repos.appointments.listOverlapping(actor.businessId, new Date(range.start), new Date(range.end));
    if (professionalId) list = list.filter((a) => a.professionalId === professionalId);
    if (q.status?.length) list = list.filter((a) => q.status!.includes(a.status));
    list.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id));

    const lookups = await this.lookups(business);
    const now = this.clock.now();
    const summaries = [];
    for (let d = q.from; d <= to; d = addDaysLocal(d, 1, tz)) {
      const inDay = list.filter((a) => toLocalDate(a.startsAt, tz) === d);
      const count = (s: Appointment['status']) => inDay.filter((a) => this.effectiveStatus(a, now) === s).length;
      summaries.push({
        date: d,
        confirmed: count('CONFIRMED'),
        pending: count('PENDING_APPROVAL'),
        completed: count('COMPLETED'),
        cancelled: count('CANCELLED'),
        noShow: count('NO_SHOW'),
      });
    }
    const blocks = (await this.repos.occupancies.listBlocks(actor.businessId, new Date(range.start), new Date(range.end)))
      .filter((o) => !professionalId || o.professionalId === professionalId)
      .sort((x, y) => x.start.getTime() - y.start.getTime())
      .map((o) => {
        const p = lookups.professionals.get(o.professionalId);
        return {
          id: o.id,
          professionalId: o.professionalId,
          professionalName: p?.name ?? '',
          colorKey: p?.colorKey ?? 'lavender',
          startsAt: toZonedIso(o.start, tz),
          endsAt: toZonedIso(o.end, tz),
          reason: o.label,
        };
      });
    return {
      timezone: tz,
      from: q.from,
      to,
      appointments: list.map((a) => this.toDto(a, actor, lookups, now)),
      days: summaries,
      blocks,
      generatedAt: now.toISOString(),
    };
  }

  async get(actor: ActorContext, id: string): Promise<AppointmentDetail> {
    const appt = await this.repos.appointments.get(actor.businessId, id);
    if (!appt || !canViewProfessionalAgenda(actor, appt.professionalId)) {
      throw new DomainError('NOT_FOUND', 'Cita no encontrada.');
    }
    const business = await this.business(actor.businessId);
    const lookups = await this.lookups(business);
    const history = await this.repos.history.listForAppointment(actor.businessId, id);
    return {
      ...this.toDto(appt, actor, lookups, this.clock.now()),
      history: history
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .map((h) => ({
          at: h.at.toISOString(),
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          action: h.action,
          actorName: h.actorName,
          reason: h.reason,
        })),
    };
  }

  // ───────────────────────── Comandos ─────────────────────────

  async create(actor: ActorContext, req: CreateAppointmentRequest): Promise<AppointmentDto> {
    if (!canCreateFor(actor, req.professionalId)) {
      throw new DomainError('FORBIDDEN', 'No tienes permiso para crear esta cita.');
    }
    const { requestId, ...payload } = req;
    return this.idempotency.execute(actor, 'appointment.create', requestId, payload, async () => {
      const business = await this.business(actor.businessId);
      if (business.status === 'SUSPENDED') throw new DomainError('POLICY_VIOLATION', 'El negocio está suspendido.');
      const now = this.clock.now();
      await this.expireDue(actor.businessId, now);

      const customer = await this.repos.customers.get(actor.businessId, req.customerId);
      if (!customer || customer.anonymizedAt || customer.mergedIntoId) {
        throw new DomainError('VALIDATION_ERROR', 'Cliente no encontrado en este negocio.', undefined, { customerId: ['No existe'] });
      }
      const start = new Date(req.startsAt).getTime();
      const date = toLocalDate(start, business.timezone);
      // Revalidar reglas vigentes dentro de la operación.
      const input = await this.availabilityInput(business, req.serviceId, date);
      const service = input.service;

      let professionalId = req.professionalId;
      if (professionalId === null) {
        const candidates = input.professionals.filter((p) => checkSlot(input, p.id, start) === null).map((p) => p.id);
        const dayBounds = localDayBounds(date, business.timezone);
        professionalId = pickProfessional(candidates, input.occupancies, dayBounds) ?? null;
        if (!professionalId) throw this.slotUnavailable(req, date);
      } else {
        const problem = checkSlot(input, professionalId, start);
        if (problem) throw this.slotUnavailable(req, date, problem);
      }

      // L07 (propuesta): citas creadas por personal autorizado se confirman directamente.
      const status = 'CONFIRMED' as const;
      const appt: Appointment = {
        id: this.ids.next('apt'),
        businessId: actor.businessId,
        customerId: customer.id,
        professionalId,
        serviceId: service.id,
        startsAt: new Date(start),
        endsAt: new Date(start + service.durationMin * MINUTE),
        status,
        source: 'STAFF_APP',
        expiresAt: null,
        version: 1,
        snapshot: {
          serviceName: service.name,
          durationMin: service.durationMin,
          bufferBeforeMin: service.bufferBeforeMin,
          bufferAfterMin: service.bufferAfterMin,
          priceMinor: service.priceMinor,
          currency: service.currency,
          policyVersion: business.policy.version,
        },
        customerNotice: 'NOT_APPLICABLE',
        createdAt: now,
        createdBy: actor.userId,
      };
      await this.repos.appointments.insert(appt);
      const occ = requiredInterval(start, service);
      await this.repos.occupancies.insert({
        id: this.ids.next('occ'),
        businessId: appt.businessId,
        professionalId,
        start: new Date(occ.start),
        end: new Date(occ.end),
        kind: 'APPOINTMENT',
        appointmentId: appt.id,
        active: true,
        label: null,
      });
      await this.recordChange(appt, null, 'create', actor, null, null, 'appointment.confirmed');
      return this.toDto(appt, actor, await this.lookups(business), now);
    });
  }

  async transition(
    actor: ActorContext,
    id: string,
    action: Exclude<AppointmentAction, 'reschedule'>,
    req: TransitionRequest,
  ): Promise<AppointmentDto> {
    const { requestId, ...payload } = req;
    return this.idempotency.execute(actor, `appointment.${action}`, requestId, { id, ...payload }, async () => {
      const business = await this.business(actor.businessId);
      // La regla evalúa la hora actual: una solicitud vencida no se aprueba aunque el
      // worker aún no la haya marcado (L08). Aprobar y vencer compiten en la misma operación.
      const now = this.clock.now();
      const appt = await this.loadForCommand(actor, id, action);
      if (appt.version !== req.expectedVersion) {
        throw new DomainError('STALE_VERSION', 'La cita cambió mientras estaba abierta. Recarga para continuar.', {
          currentVersion: appt.version,
          currentStatus: appt.status,
        });
      }
      const outcome = decideTransition(appt, action, { now, policy: policyFor(business, appt.snapshot.policyVersion), reason: req.reason });
      const from = appt.status;
      const updated: Appointment = { ...appt, status: outcome.to, version: appt.version + 1 };
      await this.repos.appointments.update(updated, appt.version);
      if (outcome.releasesSlot) await this.repos.occupancies.deactivateForAppointment(appt.businessId, appt.id);
      await this.recordChange(updated, from, action, actor, req.reason ?? null, null, outcome.eventType);
      return this.toDto(updated, actor, await this.lookups(business), now);
    });
  }

  async reschedule(actor: ActorContext, id: string, req: RescheduleRequest): Promise<AppointmentDto> {
    const { requestId, ...payload } = req;
    return this.idempotency.execute(actor, 'appointment.reschedule', requestId, { id, ...payload }, async () => {
      const business = await this.business(actor.businessId);
      const now = this.clock.now();
      const appt = await this.loadForCommand(actor, id, 'reschedule');
      if (appt.version !== req.expectedVersion) {
        throw new DomainError('STALE_VERSION', 'La cita cambió mientras estaba abierta. Recarga para continuar.', {
          currentVersion: appt.version,
        });
      }
      decideTransition(appt, 'reschedule', { now, policy: policyFor(business, appt.snapshot.policyVersion) });
      const professionalId = req.professionalId ?? appt.professionalId;
      if (professionalId !== appt.professionalId && !canCreateFor(actor, professionalId)) {
        throw new DomainError('FORBIDDEN', 'No puedes asignar la cita a ese profesional.');
      }
      const start = new Date(req.startsAt).getTime();
      const date = toLocalDate(start, business.timezone);
      // MVP: se conservan servicio y cliente; la duración proviene del snapshot.
      const input = await this.availabilityInput(business, appt.serviceId, date, appt.id);
      const snapshotService: Service = {
        ...input.service,
        durationMin: appt.snapshot.durationMin,
        bufferBeforeMin: appt.snapshot.bufferBeforeMin,
        bufferAfterMin: appt.snapshot.bufferAfterMin,
      };
      const problem = checkSlot({ ...input, service: snapshotService }, professionalId, start);
      // Un conflicto conserva la cita original y su ocupación intactas.
      if (problem) throw this.slotUnavailable({ serviceId: appt.serviceId, professionalId, startsAt: req.startsAt }, date, problem);

      const previousStart = appt.startsAt;
      const updated: Appointment = {
        ...appt,
        professionalId,
        startsAt: new Date(start),
        endsAt: new Date(start + appt.snapshot.durationMin * MINUTE),
        version: appt.version + 1,
      };
      await this.repos.appointments.update(updated, appt.version);
      await this.repos.occupancies.deactivateForAppointment(appt.businessId, appt.id);
      const occ = requiredInterval(start, snapshotService);
      await this.repos.occupancies.insert({
        id: this.ids.next('occ'),
        businessId: appt.businessId,
        professionalId,
        start: new Date(occ.start),
        end: new Date(occ.end),
        kind: 'APPOINTMENT',
        appointmentId: appt.id,
        active: true,
        label: null,
      });
      await this.recordChange(updated, appt.status, 'reschedule', actor, req.reason ?? null, previousStart, 'appointment.rescheduled');
      return this.toDto(updated, actor, await this.lookups(business), now);
    });
  }

  /** Worker: vence solicitudes pendientes de todos los negocios. Idempotente. */
  async expireAllDue(): Promise<number> {
    const now = this.clock.now();
    const due = await this.repos.appointments.listExpiredPending(now);
    const businesses = [...new Set(due.map((a) => a.businessId))];
    let total = 0;
    for (const bid of businesses) {
      total += await this.uow.run([bid], () => this.expireDue(bid, now));
    }
    return total;
  }

  // ───────────────────────── Internos ─────────────────────────

  /** Debe ejecutarse dentro de una unidad de trabajo. */
  private async expireDue(businessId: string, now: Date): Promise<number> {
    const due = (await this.repos.appointments.listExpiredPending(now)).filter((a) => a.businessId === businessId);
    for (const appt of due) {
      const outcome = decideTransition(appt, 'expire', { now, policy: (await this.business(businessId)).policy });
      const updated: Appointment = { ...appt, status: outcome.to, version: appt.version + 1 };
      await this.repos.appointments.update(updated, appt.version);
      await this.repos.occupancies.deactivateForAppointment(businessId, appt.id);
      await this.recordChange(updated, appt.status, 'expire', null, 'Plazo de aprobación vencido', null, outcome.eventType);
    }
    return due.length;
  }

  private async loadForCommand(actor: ActorContext, id: string, action: AppointmentAction): Promise<Appointment> {
    const appt = await this.repos.appointments.get(actor.businessId, id);
    if (!appt || !canViewProfessionalAgenda(actor, appt.professionalId)) {
      throw new DomainError('NOT_FOUND', 'Cita no encontrada.');
    }
    if (!canActOn(actor, appt, action)) throw new DomainError('FORBIDDEN', 'No tienes permiso para esta acción.');
    return appt;
  }

  private slotUnavailable(req: { serviceId: string; professionalId: string | null; startsAt: string }, date: string, reason?: string) {
    // Contexto seguro para volver a consultar; no inventa alternativas.
    return new DomainError('SLOT_UNAVAILABLE', reason ?? 'El horario ya no está disponible.', {
      serviceId: req.serviceId,
      professionalId: req.professionalId,
      date,
      requestedStartsAt: req.startsAt,
    });
  }

  private async recordChange(
    appt: Appointment,
    from: Appointment['status'] | null,
    action: string,
    actor: ActorContext | null,
    reason: string | null,
    previousStartsAt: Date | null,
    eventType: string,
  ): Promise<void> {
    const now = this.clock.now();
    await this.repos.history.append({
      appointmentId: appt.id,
      businessId: appt.businessId,
      at: now,
      fromStatus: from,
      toStatus: appt.status,
      action,
      actorId: actor?.userId ?? SYSTEM_ACTOR.id,
      actorName: actor?.userName ?? SYSTEM_ACTOR.name,
      reason,
      previousStartsAt,
    });
    await this.repos.outbox.append({
      eventId: this.ids.next('evt'),
      eventType,
      schemaVersion: 1,
      occurredAt: now,
      businessId: appt.businessId,
      aggregateId: appt.id,
      aggregateVersion: appt.version,
      correlationId: actor?.correlationId ?? `sys-${now.getTime()}`,
      payload: {
        appointmentId: appt.id,
        customerId: appt.customerId,
        serviceId: appt.serviceId,
        professionalId: appt.professionalId,
        startsAt: appt.startsAt.toISOString(),
        status: appt.status,
        ...(eventType === 'appointment.completed' ? { completedAt: now.toISOString() } : {}),
        ...(previousStartsAt ? { previousStartsAt: previousStartsAt.toISOString() } : {}),
      },
      status: 'PENDING',
      attempts: 0,
      actorId: actor?.userId ?? SYSTEM_ACTOR.id,
    });
  }

  private async business(id: string): Promise<Business> {
    const b = await this.repos.businesses.get(id);
    if (!b) throw new DomainError('NOT_FOUND', 'Negocio no encontrado.');
    return b;
  }

  private async availabilityInput(business: Business, serviceId: string, date: string, excludeAppointmentId?: string): Promise<AvailabilityInput> {
    const bid = business.id;
    const services = await this.repos.catalog.services(bid);
    const service = services.find((s) => s.id === serviceId);
    if (!service) throw new DomainError('VALIDATION_ERROR', 'Servicio no encontrado.', undefined, { serviceId: ['No existe'] });
    if (!service.active) throw new DomainError('POLICY_VIOLATION', 'El servicio está archivado y no admite reservas nuevas.');
    const professionals = await this.repos.catalog.professionals(bid);
    const links = await this.repos.catalog.professionalServices(bid);
    const day = localDayBounds(date, business.timezone);
    return {
      date,
      zone: business.timezone,
      now: this.clock.now(),
      policy: business.policy,
      service,
      professionals,
      enabledProfessionalIds: new Set(links.filter((l) => l.serviceId === serviceId).map((l) => l.professionalId)),
      businessHours: await this.repos.schedules.businessHours(bid),
      professionalHours: await this.repos.schedules.professionalHours(bid),
      exceptions: await this.repos.schedules.exceptions(bid, date, date),
      // Margen de un día para buffers que crucen la medianoche.
      occupancies: await this.repos.occupancies.listActive(
        bid,
        professionals.map((p) => p.id),
        new Date(day.start - 24 * 60 * MINUTE),
        new Date(day.end + 24 * 60 * MINUTE),
      ),
      ...(excludeAppointmentId ? { excludeAppointmentId } : {}),
    };
  }

  async lookups(business: Business): Promise<Lookups> {
    const [professionals, services, customers, appts] = await Promise.all([
      this.repos.catalog.professionals(business.id),
      this.repos.catalog.services(business.id),
      this.repos.customers.list(business.id),
      this.repos.appointments.listAll(business.id),
    ]);
    const completedByCustomer = new Map<string, number>();
    appts.filter((a) => a.status === 'COMPLETED').forEach((a) => completedByCustomer.set(a.customerId, (completedByCustomer.get(a.customerId) ?? 0) + 1));
    return {
      business,
      professionals: new Map(professionals.map((p) => [p.id, p])),
      services: new Map(services.map((s) => [s.id, s])),
      customers: new Map(customers.map((c) => [c.id, c])),
      completedByCustomer,
    };
  }

  /** Estado a mostrar: una pendiente vencida se presenta como vencida aunque el worker no haya corrido. */
  private effectiveStatus(a: Appointment, now: Date): Appointment['status'] {
    return isExpired(a, now) ? 'EXPIRED' : a.status;
  }

  toDto(a: Appointment, actor: ActorContext, l: Lookups, now: Date): AppointmentDto {
    const tz = l.business.timezone;
    const pro = l.professionals.get(a.professionalId);
    const customer = l.customers.get(a.customerId);
    const status = this.effectiveStatus(a, now);
    const view = { ...a, status };
    const allowedActions = ACTIVE_STATUSES.has(status)
      ? actionsAllowedByState(view, { now, policy: policyFor(l.business, a.snapshot.policyVersion) }).filter((act) => canActOn(actor, a, act))
      : [];
    return {
      id: a.id,
      businessId: a.businessId,
      status,
      source: a.source,
      startsAt: toZonedIso(a.startsAt, tz),
      endsAt: toZonedIso(a.endsAt, tz),
      timezone: tz,
      version: a.version,
      expiresAt: a.expiresAt ? toZonedIso(a.expiresAt, tz) : null,
      customer: {
        id: a.customerId,
        name: customer?.name ?? 'Cliente',
        firstVisit: (l.completedByCustomer.get(a.customerId) ?? 0) === 0,
      },
      professional: {
        id: a.professionalId,
        name: pro?.name ?? 'Profesional',
        initials: initials(pro?.name ?? '?'),
        colorKey: pro?.colorKey ?? 'lavender',
      },
      service: {
        id: a.serviceId,
        name: a.snapshot.serviceName,
        durationMin: a.snapshot.durationMin,
        price: { amountMinor: a.snapshot.priceMinor, currency: a.snapshot.currency },
      },
      policyVersion: a.snapshot.policyVersion,
      allowedActions,
      customerNotice: a.customerNotice,
      createdAt: a.createdAt.toISOString(),
    };
  }
}
