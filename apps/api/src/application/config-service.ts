import type {
  Block,
  CreateBlockRequest,
  ExceptionRequest,
  Professional as ProfessionalDto,
  SaveProfessionalRequest,
  SaveServiceRequest,
  ScheduleChangeResult,
  ScheduleConflict,
  Service as ServiceDto,
  WeeklyHoursRequest,
} from '@orion/contracts';
import {
  CreateBlockRequest as CreateBlockSchema,
  ExceptionRequest as ExceptionSchema,
  SaveProfessionalRequest as SaveProfessionalSchema,
  SaveServiceRequest as SaveServiceSchema,
  WeeklyHoursRequest as WeeklyHoursSchema,
} from '@orion/contracts';
import { workingIntervals } from '../domain/availability.js';
import type { Clock } from '../domain/clock.js';
import { DomainError } from '../domain/errors.js';
import type { IdGenerator } from '../domain/ids.js';
import { contains, MINUTE } from '../domain/interval.js';
import { ACTIVE_STATUSES } from '../domain/lifecycle.js';
import { addDaysLocal, localIntervals, toLocalDate, toZonedIso } from '../domain/local-time.js';
import type { ActorContext, Appointment, Business, Professional, ScheduleException, Service, WeeklyHours } from '../domain/model.js';
import { requirePermission } from '../domain/permissions.js';
import type { IdempotencyService } from './idempotency-service.js';
import type { Repositories } from './ports.js';
import { initials } from './presentation.js';

const MAX_BLOCK_MS = 14 * 24 * 60 * MINUTE;
/** Mismas claves que `professionalColors` de @orion/design-tokens. */
const COLOR_KEYS = ['lavender', 'mint', 'peach', 'sky', 'rose'];

/**
 * Configuración del negocio (P17–P19). Reglas clave:
 * - Editar un servicio no altera citas existentes (snapshot); archivar no borra historial.
 * - Desactivar un profesional con citas futuras exige resolverlas antes (L03).
 * - Cambiar horarios nunca mueve ni cancela citas en silencio: se devuelven los conflictos (L05).
 * - Los bloqueos comparten la protección de exclusión con las citas.
 */
export class ConfigService {
  constructor(
    private readonly repos: Repositories,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly idempotency: IdempotencyService,
  ) {}

  private async business(id: string): Promise<Business> {
    const b = await this.repos.businesses.get(id);
    if (!b) throw new DomainError('NOT_FOUND', 'Negocio no encontrado.');
    return b;
  }

  // ───────────────────────── Servicios ─────────────────────────

  async saveService(actor: ActorContext, serviceId: string | null, raw: SaveServiceRequest): Promise<ServiceDto> {
    requirePermission(actor, 'catalog.manage');
    const req = SaveServiceSchema.parse(raw);
    const { requestId, ...payload } = req;
    const saved = await this.idempotency.execute(actor, serviceId ? `service.update.${serviceId}` : 'service.create', requestId, payload, async () => {
      const b = await this.business(actor.businessId);
      const pros = await this.repos.catalog.professionals(actor.businessId);
      const unknown = req.professionalIds.filter((id) => !pros.some((p) => p.id === id));
      if (unknown.length) throw new DomainError('VALIDATION_ERROR', 'Hay profesionales que no pertenecen a este negocio.', undefined, { professionalIds: ['No válido'] });
      let service: Service;
      if (serviceId) {
        const existing = (await this.repos.catalog.services(actor.businessId)).find((s) => s.id === serviceId);
        if (!existing) throw new DomainError('NOT_FOUND', 'Servicio no encontrado.');
        service = { ...existing };
      } else {
        service = { id: this.ids.next('svc'), businessId: actor.businessId, name: '', durationMin: 0, bufferBeforeMin: 0, bufferAfterMin: 0, priceMinor: 0, currency: b.currency, active: true };
      }
      Object.assign(service, {
        name: req.name,
        durationMin: req.durationMin,
        bufferBeforeMin: req.bufferBeforeMin,
        bufferAfterMin: req.bufferAfterMin,
        priceMinor: req.priceMinor,
        active: req.active,
      });
      await this.repos.catalogWriter.upsertService(service);
      await this.repos.catalogWriter.setServiceProfessionals(actor.businessId, service.id, req.professionalIds);
      return { id: service.id };
    });
    return (await this.services(actor)).find((s) => s.id === saved.id)!;
  }

  async services(actor: ActorContext): Promise<ServiceDto[]> {
    const [services, links] = await Promise.all([this.repos.catalog.services(actor.businessId), this.repos.catalog.professionalServices(actor.businessId)]);
    return services
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'es'))
      .map((s) => ({
        id: s.id,
        name: s.name,
        durationMin: s.durationMin,
        bufferBeforeMin: s.bufferBeforeMin,
        bufferAfterMin: s.bufferAfterMin,
        price: { amountMinor: s.priceMinor, currency: s.currency },
        active: s.active,
        professionalIds: links.filter((l) => l.serviceId === s.id).map((l) => l.professionalId),
      }));
  }

  // ───────────────────────── Equipo ─────────────────────────

  async saveProfessional(actor: ActorContext, professionalId: string | null, raw: SaveProfessionalRequest): Promise<ProfessionalDto> {
    requirePermission(actor, professionalId ? 'catalog.manage' : 'team.manage');
    const req = SaveProfessionalSchema.parse(raw);
    if (!COLOR_KEYS.includes(req.colorKey)) {
      throw new DomainError('VALIDATION_ERROR', 'Color no válido.', undefined, { colorKey: ['No válido'] });
    }
    const { requestId, ...payload } = req;
    const saved = await this.idempotency.execute(actor, professionalId ? `professional.update.${professionalId}` : 'professional.create', requestId, payload, async () => {
      const services = await this.repos.catalog.services(actor.businessId);
      if (req.serviceIds.some((id) => !services.some((s) => s.id === id))) {
        throw new DomainError('VALIDATION_ERROR', 'Hay servicios que no pertenecen a este negocio.', undefined, { serviceIds: ['No válido'] });
      }
      let pro: Professional;
      if (professionalId) {
        const existing = (await this.repos.catalog.professionals(actor.businessId)).find((p) => p.id === professionalId);
        if (!existing) throw new DomainError('NOT_FOUND', 'Profesional no encontrado.');
        pro = { ...existing, name: req.name, colorKey: req.colorKey };
      } else {
        // Crear un profesional no crea un usuario de acceso (L03).
        pro = { id: this.ids.next('pro'), businessId: actor.businessId, name: req.name, colorKey: req.colorKey, userId: null, active: true };
        // Jornada inicial = horario del negocio, editable después.
        const biz = await this.repos.schedules.businessHours(actor.businessId);
        await this.repos.scheduleWriter.setWeekly({ businessId: actor.businessId, professionalId: pro.id, days: structuredClone(biz.days) });
      }
      await this.repos.catalogWriter.upsertProfessional(pro);
      await this.repos.catalogWriter.setProfessionalServices(actor.businessId, pro.id, req.serviceIds);
      return { id: pro.id };
    });
    return (await this.professionals(actor)).find((p) => p.id === saved.id)!;
  }

  async professionals(actor: ActorContext): Promise<ProfessionalDto[]> {
    const [pros, links] = await Promise.all([this.repos.catalog.professionals(actor.businessId), this.repos.catalog.professionalServices(actor.businessId)]);
    return pros.map((p) => ({
      id: p.id,
      name: p.name,
      initials: initials(p.name),
      colorKey: p.colorKey,
      active: p.active,
      hasUserAccess: p.userId !== null,
      serviceIds: links.filter((l) => l.professionalId === p.id).map((l) => l.serviceId),
    }));
  }

  /** Citas futuras activas de un profesional (para reasignar o cancelar antes de la baja). */
  async futureAppointments(actor: ActorContext, professionalId: string): Promise<ScheduleConflict[]> {
    requirePermission(actor, 'agenda.view_all');
    const now = this.clock.now().getTime();
    const appts = (await this.repos.appointments.listAll(actor.businessId)).filter(
      (a) => a.professionalId === professionalId && ACTIVE_STATUSES.has(a.status) && a.endsAt.getTime() > now,
    );
    return this.toConflicts(actor.businessId, appts);
  }

  async setProfessionalActive(actor: ActorContext, professionalId: string, active: boolean, requestId: string): Promise<ProfessionalDto> {
    requirePermission(actor, 'team.manage');
    await this.idempotency.execute(actor, `professional.active.${professionalId}`, requestId, { active }, async () => {
      const pro = (await this.repos.catalog.professionals(actor.businessId)).find((p) => p.id === professionalId);
      if (!pro) throw new DomainError('NOT_FOUND', 'Profesional no encontrado.');
      if (!active) {
        const pending = await this.futureAppointments(actor, professionalId);
        if (pending.length > 0) {
          // No se trasladan citas automáticamente a otra persona (L03).
          throw new DomainError('POLICY_VIOLATION', `${pro.name} tiene ${pending.length} citas futuras. Reasígnalas o cancélalas antes de desactivar.`, {
            conflicts: pending,
          });
        }
      }
      await this.repos.catalogWriter.upsertProfessional({ ...pro, active });
      return { id: pro.id };
    });
    return (await this.professionals(actor)).find((p) => p.id === professionalId)!;
  }

  // ───────────────────────── Horarios ─────────────────────────

  async setWeeklyHours(actor: ActorContext, raw: WeeklyHoursRequest): Promise<ScheduleChangeResult> {
    requirePermission(actor, 'schedules.manage');
    const req = WeeklyHoursSchema.parse(raw);
    const b = await this.business(actor.businessId);
    if (req.professionalId && !(await this.repos.catalog.professionals(b.id)).some((p) => p.id === req.professionalId)) {
      throw new DomainError('NOT_FOUND', 'Profesional no encontrado.');
    }
    const days: WeeklyHours['days'] = {};
    for (const d of req.days) {
      validateRanges(d.intervals, b.timezone);
      if (d.intervals.length) days[d.weekday] = [...d.intervals].sort((x, y) => x.start.localeCompare(y.start));
    }
    const proposed: WeeklyHours = { businessId: b.id, professionalId: req.professionalId, days };
    const run = async () => {
      const conflicts = await this.conflictsFor(b, { weekly: proposed });
      if (req.dryRun) return { applied: false, conflicts };
      if (conflicts.length) {
        throw new DomainError('POLICY_VIOLATION', 'El cambio deja citas fuera del horario. Resuélvelas antes de aplicarlo.', { conflicts });
      }
      await this.repos.scheduleWriter.setWeekly(proposed);
      return { applied: true, conflicts: [] };
    };
    if (req.dryRun) return run();
    const { requestId, ...payload } = req;
    return this.idempotency.execute(actor, 'schedule.weekly', requestId, payload, run);
  }

  async saveException(actor: ActorContext, raw: ExceptionRequest): Promise<ScheduleChangeResult> {
    requirePermission(actor, 'schedules.manage');
    const req = ExceptionSchema.parse(raw);
    const b = await this.business(actor.businessId);
    if (req.professionalId && !(await this.repos.catalog.professionals(b.id)).some((p) => p.id === req.professionalId)) {
      throw new DomainError('NOT_FOUND', 'Profesional no encontrado.');
    }
    const today = toLocalDate(this.clock.now(), b.timezone);
    if (req.date < today) throw new DomainError('VALIDATION_ERROR', 'La fecha ya pasó.', undefined, { date: ['Elige hoy o una fecha futura'] });
    if (!req.closed) {
      if (req.intervals.length === 0) throw new DomainError('VALIDATION_ERROR', 'Indica el horario especial o marca el día como cerrado.');
      validateRanges(req.intervals, b.timezone);
    }
    const existing = (await this.repos.schedules.exceptions(b.id, req.date, req.date)).find((e) => e.professionalId === req.professionalId);
    const proposed: ScheduleException = {
      id: existing?.id ?? this.ids.next('exc'),
      businessId: b.id,
      professionalId: req.professionalId,
      date: req.date,
      closed: req.closed,
      intervals: req.closed ? [] : req.intervals,
      reason: req.reason?.trim() || null,
    };
    const run = async () => {
      const conflicts = await this.conflictsFor(b, { exception: proposed });
      if (req.dryRun) return { applied: false, conflicts };
      if (conflicts.length) {
        throw new DomainError('POLICY_VIOLATION', 'Hay citas reservadas en ese día. Resuélvelas antes de aplicar la excepción.', { conflicts });
      }
      await this.repos.scheduleWriter.upsertException(proposed);
      return { applied: true, conflicts: [] };
    };
    if (req.dryRun) return run();
    const { requestId, ...payload } = req;
    return this.idempotency.execute(actor, 'schedule.exception', requestId, payload, run);
  }

  async deleteException(actor: ActorContext, id: string, requestId: string): Promise<void> {
    requirePermission(actor, 'schedules.manage');
    await this.idempotency.execute(actor, `schedule.exception.delete.${id}`, requestId, { id }, async () => {
      // Quitar una excepción solo puede ampliar o restaurar la jornada habitual; aun así se
      // revisan conflictos por si la jornada habitual es más corta que el horario especial.
      const b = await this.business(actor.businessId);
      const all = await this.repos.schedules.exceptions(b.id, '0000-01-01', '9999-12-31');
      const exc = all.find((e) => e.id === id);
      if (!exc) throw new DomainError('NOT_FOUND', 'Excepción no encontrada.');
      const conflicts = await this.conflictsFor(b, { removeExceptionId: id });
      if (conflicts.length) throw new DomainError('POLICY_VIOLATION', 'Quitar la excepción deja citas fuera del horario habitual.', { conflicts });
      await this.repos.scheduleWriter.deleteException(b.id, id);
      return { ok: true };
    });
  }

  // ───────────────────────── Bloqueos ─────────────────────────

  async createBlock(actor: ActorContext, raw: CreateBlockRequest): Promise<Block> {
    requirePermission(actor, 'schedules.manage');
    const req = CreateBlockSchema.parse(raw);
    const { requestId, ...payload } = req;
    const created = await this.idempotency.execute(actor, 'block.create', requestId, payload, async () => {
      const pro = (await this.repos.catalog.professionals(actor.businessId)).find((p) => p.id === req.professionalId);
      if (!pro) throw new DomainError('NOT_FOUND', 'Profesional no encontrado.');
      const start = new Date(req.startsAt).getTime();
      const end = new Date(req.endsAt).getTime();
      if (end <= start) throw new DomainError('VALIDATION_ERROR', 'La hora de fin debe ser posterior al inicio.', undefined, { endsAt: ['Debe ser posterior al inicio'] });
      if (end - start > MAX_BLOCK_MS) throw new DomainError('VALIDATION_ERROR', 'Un bloqueo puede durar como máximo 14 días; usa una excepción de horario.');
      if (end <= this.clock.now().getTime()) throw new DomainError('VALIDATION_ERROR', 'El bloqueo ya terminó.');
      const id = this.ids.next('blk');
      // La misma restricción de exclusión que protege a las citas rechaza el traslape.
      await this.repos.occupancies
        .insert({ id, businessId: actor.businessId, professionalId: pro.id, start: new Date(start), end: new Date(end), kind: 'BLOCK', appointmentId: null, active: true, label: req.reason?.trim() || null })
        .catch((err) => {
          if (err instanceof DomainError && err.code === 'SLOT_UNAVAILABLE') {
            throw new DomainError('SLOT_UNAVAILABLE', 'Ese horario se cruza con una cita u otro bloqueo de este profesional.');
          }
          throw err;
        });
      return { id };
    });
    const b = await this.business(actor.businessId);
    return (await this.blocks(actor, new Date(0), new Date(8.64e15))).find((x) => x.id === created.id) ?? this.blockNotFound(b);
  }

  private blockNotFound(_b: Business): never {
    throw new DomainError('NOT_FOUND', 'Bloqueo no encontrado.');
  }

  async removeBlock(actor: ActorContext, id: string, requestId: string): Promise<void> {
    requirePermission(actor, 'schedules.manage');
    await this.idempotency.execute(actor, `block.remove.${id}`, requestId, { id }, async () => {
      const blk = await this.repos.occupancies.getBlock(actor.businessId, id);
      if (!blk) throw new DomainError('NOT_FOUND', 'Bloqueo no encontrado.');
      await this.repos.occupancies.deactivate(actor.businessId, id);
      return { ok: true };
    });
  }

  async blocks(actor: ActorContext, from: Date, to: Date): Promise<Block[]> {
    const b = await this.business(actor.businessId);
    const [blocks, pros] = await Promise.all([this.repos.occupancies.listBlocks(b.id, from, to), this.repos.catalog.professionals(b.id)]);
    return blocks
      .filter((o) => actor.permissions.has('agenda.view_all') || o.professionalId === actor.professionalId)
      .sort((x, y) => x.start.getTime() - y.start.getTime())
      .map((o) => {
        const p = pros.find((x) => x.id === o.professionalId);
        return {
          id: o.id,
          professionalId: o.professionalId,
          professionalName: p?.name ?? '',
          colorKey: p?.colorKey ?? 'lavender',
          startsAt: toZonedIso(o.start, b.timezone),
          endsAt: toZonedIso(o.end, b.timezone),
          reason: o.label,
        };
      });
  }

  // ───────────────────────── Conflictos ─────────────────────────

  /**
   * Citas futuras activas que dejarían de caber íntegras en la jornada si se aplica el
   * cambio propuesto. Se evalúa con el mismo `workingIntervals` del motor de disponibilidad.
   */
  private async conflictsFor(
    b: Business,
    change: { weekly?: WeeklyHours; exception?: ScheduleException; removeExceptionId?: string },
  ): Promise<ScheduleConflict[]> {
    const now = this.clock.now();
    const today = toLocalDate(now, b.timezone);
    const horizonEnd = addDaysLocal(today, b.policy.maxHorizonDays + 1, b.timezone);
    let businessHours = await this.repos.schedules.businessHours(b.id);
    let professionalHours = await this.repos.schedules.professionalHours(b.id);
    let exceptions = await this.repos.schedules.exceptions(b.id, today, horizonEnd);
    if (change.weekly) {
      if (change.weekly.professionalId === null) businessHours = change.weekly;
      else professionalHours = [...professionalHours.filter((h) => h.professionalId !== change.weekly!.professionalId), change.weekly];
    }
    if (change.exception) {
      const e = change.exception;
      exceptions = [...exceptions.filter((x) => !(x.date === e.date && x.professionalId === e.professionalId)), e];
    }
    if (change.removeExceptionId) exceptions = exceptions.filter((x) => x.id !== change.removeExceptionId);

    const affected = (await this.repos.appointments.listAll(b.id)).filter(
      (a) =>
        ACTIVE_STATUSES.has(a.status) &&
        a.startsAt.getTime() > now.getTime() &&
        (!change.weekly?.professionalId || a.professionalId === change.weekly.professionalId) &&
        (!change.exception || toLocalDate(a.startsAt, b.timezone) === change.exception.date) &&
        (!change.exception?.professionalId || a.professionalId === change.exception.professionalId),
    );
    const out: Appointment[] = [];
    for (const a of affected) {
      const date = toLocalDate(a.startsAt, b.timezone);
      const { intervals } = workingIntervals({ date, zone: b.timezone, businessHours, professionalHours, exceptions }, a.professionalId);
      const service = { start: a.startsAt.getTime(), end: a.endsAt.getTime() };
      if (!intervals.some((w) => contains(w, service))) out.push(a);
    }
    return this.toConflicts(b.id, out);
  }

  private async toConflicts(businessId: string, appts: Appointment[]): Promise<ScheduleConflict[]> {
    const b = await this.business(businessId);
    const [customers, pros] = await Promise.all([this.repos.customers.list(businessId), this.repos.catalog.professionals(businessId)]);
    return appts
      .sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime())
      .map((a) => ({
        appointmentId: a.id,
        startsAt: toZonedIso(a.startsAt, b.timezone),
        endsAt: toZonedIso(a.endsAt, b.timezone),
        status: a.status,
        customerName: customers.find((c) => c.id === a.customerId)?.name ?? '',
        professionalName: pros.find((p) => p.id === a.professionalId)?.name ?? '',
        serviceName: a.snapshot.serviceName,
      }));
  }
}

/** Intervalos válidos: inicio < fin, sin traslapes. El horario nocturno no se admite (L05). */
function validateRanges(ranges: Array<{ start: string; end: string }>, zone: string) {
  const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]!;
    if (r.end <= r.start) throw new DomainError('VALIDATION_ERROR', `El intervalo ${r.start}–${r.end} no es válido: el fin debe ser posterior al inicio.`);
    const next = sorted[i + 1];
    if (next && next.start < r.end) throw new DomainError('VALIDATION_ERROR', `Los intervalos ${r.start}–${r.end} y ${next.start}–${next.end} se traslapan.`);
  }
  // Comprueba que las horas existan en la zona (luxon valida el formato).
  localIntervals('2026-01-05', sorted, zone);
}
