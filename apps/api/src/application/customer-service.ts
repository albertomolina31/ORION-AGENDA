import type {
  CreateCustomerNoteRequest,
  CustomerNote,
  UpdateCustomerRequest,
  CreateCustomerRequest,
  CustomerDetail,
  CustomerListQuery,
  CustomerListResponse,
  CustomerSegment,
  CustomerSummary,
} from '@orion/contracts';
import {
  CreateCustomerNoteRequest as CreateNoteSchema,
  CreateCustomerRequest as CreateCustomerSchema,
  CUSTOMER_NOTE_VISIBILITY_LABELS,
  CustomerListQuery as ListSchema,
  UpdateCustomerRequest as UpdateCustomerSchema,
} from '@orion/contracts';
import { toZonedIso } from '../domain/local-time.js';
import type { Clock } from '../domain/clock.js';
import { DomainError } from '../domain/errors.js';
import type { IdGenerator } from '../domain/ids.js';
import { ACTIVE_STATUSES } from '../domain/lifecycle.js';
import { type ActorContext, type Appointment, type Customer, type CustomerNoteRecord, isActiveCustomer, type Professional } from '../domain/model.js';
import { requirePermission } from '../domain/permissions.js';
import type { IdempotencyService } from './idempotency-service.js';
import type { Repositories } from './ports.js';
import { initials, maskPhone, normalizeName, normalizePhone } from './presentation.js';
import { consentEventDto } from './privacy-service.js';

/** Propuesta: "habitual" = 3 o más visitas completadas. Configurable, no aprobado. */
export const REGULAR_MIN_VISITS = 3;

interface Derived {
  customer: Customer;
  completed: Appointment[];
  next: Appointment | undefined;
}

/** L12: el cliente pertenece al contexto de un negocio; no se fusiona automáticamente. */
export class CustomerService {
  constructor(
    private readonly repos: Repositories,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly idempotency: IdempotencyService,
  ) {}

  private async derive(actor: ActorContext): Promise<{ rows: Derived[]; pros: Map<string, Professional> }> {
    const [customers, appts, pros] = await Promise.all([
      this.repos.customers.list(actor.businessId),
      this.repos.appointments.listAll(actor.businessId),
      this.repos.catalog.professionals(actor.businessId),
    ]);
    const now = this.clock.now().getTime();
    let visible = customers;
    if (!actor.permissions.has('customers.view_all')) {
      // Profesional: solo clientes con citas asignadas a él/ella.
      const own = new Set(appts.filter((a) => a.professionalId === actor.professionalId).map((a) => a.customerId));
      visible = customers.filter((c) => own.has(c.id));
    }
    const byCustomer = new Map<string, Appointment[]>();
    appts.forEach((a) => byCustomer.set(a.customerId, [...(byCustomer.get(a.customerId) ?? []), a]));
    const rows = visible.map((customer) => {
      const list = byCustomer.get(customer.id) ?? [];
      const completed = list.filter((a) => a.status === 'COMPLETED').sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
      const next = list
        .filter((a) => ACTIVE_STATUSES.has(a.status) && a.endsAt.getTime() > now)
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
      return { customer, completed, next };
    });
    return { rows, pros: new Map(pros.map((p) => [p.id, p])) };
  }

  private inSegment(d: Derived, segment: CustomerSegment): boolean {
    switch (segment) {
      case 'ALL':
        return true;
      case 'WITH_UPCOMING':
        return !!d.next;
      case 'NO_UPCOMING':
        return !d.next;
      case 'FIRST_VISIT':
        return !!d.next && d.completed.length === 0;
      case 'REGULARS':
        return d.completed.length >= REGULAR_MIN_VISITS;
    }
  }

  private summary(d: Derived, pros: Map<string, Professional>): CustomerSummary {
    return {
      id: d.customer.id,
      name: d.customer.name,
      initials: initials(d.customer.name),
      phoneMasked: maskPhone(d.customer.phoneE164),
      lastVisitAt: d.completed[0]?.startsAt.toISOString() ?? null,
      completedVisits: d.completed.length,
      promotionalConsent: d.customer.promotionalConsent,
      nextAppointment: d.next
        ? {
            appointmentId: d.next.id,
            startsAt: d.next.startsAt.toISOString(),
            status: d.next.status,
            serviceName: d.next.snapshot.serviceName,
            professionalName: pros.get(d.next.professionalId)?.name ?? '',
          }
        : null,
    };
  }

  async list(actor: ActorContext, rawQuery: CustomerListQuery): Promise<CustomerListResponse> {
    const q = ListSchema.parse(rawQuery);
    const { rows: all, pros } = await this.derive(actor);
    // Los clientes eliminados por solicitud o unidos a otro no aparecen en listas ni búsquedas.
    const rows = all.filter((d) => isActiveCustomer(d.customer));
    const needle = q.q ? normalizeName(q.q) : '';
    const digits = q.q?.replace(/\D/g, '') ?? '';
    const searched = rows.filter(
      (d) =>
        !needle ||
        normalizeName(d.customer.name).includes(needle) ||
        (digits.length >= 3 && (d.customer.phoneE164 ?? '').includes(digits)),
    );
    const segmentCounts = Object.fromEntries(
      (['ALL', 'WITH_UPCOMING', 'NO_UPCOMING', 'FIRST_VISIT', 'REGULARS'] as const).map((s) => [
        s,
        searched.filter((d) => this.inSegment(d, s)).length,
      ]),
    ) as Record<CustomerSegment, number>;
    const filtered = searched.filter((d) => this.inSegment(d, q.segment));
    const sorters: Record<typeof q.sort, (a: Derived, b: Derived) => number> = {
      NAME: (a, b) => a.customer.name.localeCompare(b.customer.name, 'es'),
      NEXT_APPOINTMENT: (a, b) =>
        (a.next?.startsAt.getTime() ?? Infinity) - (b.next?.startsAt.getTime() ?? Infinity) ||
        a.customer.name.localeCompare(b.customer.name, 'es'),
      LAST_VISIT: (a, b) => (b.completed[0]?.startsAt.getTime() ?? 0) - (a.completed[0]?.startsAt.getTime() ?? 0),
    };
    filtered.sort(sorters[q.sort]);
    const offset = q.cursor ? Number.parseInt(q.cursor, 10) || 0 : 0;
    const page = filtered.slice(offset, offset + q.limit);
    return {
      items: page.map((d) => this.summary(d, pros)),
      total: filtered.length,
      nextCursor: offset + q.limit < filtered.length ? String(offset + q.limit) : null,
      segmentCounts,
    };
  }

  async get(actor: ActorContext, id: string): Promise<CustomerDetail> {
    const { rows, pros } = await this.derive(actor);
    const d = rows.find((r) => r.customer.id === id);
    if (!d) throw new DomainError('NOT_FOUND', 'Cliente no encontrado.');
    if (d.customer.mergedIntoId) {
      throw new DomainError('NOT_FOUND', 'Este cliente se unió con otro registro.', { mergedIntoId: d.customer.mergedIntoId });
    }
    const all = (await this.repos.appointments.listByCustomer(actor.businessId, id))
      .filter((a) => actor.permissions.has('customers.view_all') || a.professionalId === actor.professionalId)
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
    const c = d.customer;
    const zone = (await this.repos.businesses.get(actor.businessId))?.timezone ?? 'UTC';
    return {
      ...this.summary(d, pros),
      phone: actor.permissions.has('customers.view_all') ? c.phoneE164 : null,
      email: actor.permissions.has('customers.view_all') ? c.email : null,
      customerSince: c.createdAt.toISOString(),
      preferredProfessional: c.preferredProfessionalId
        ? { id: c.preferredProfessionalId, name: pros.get(c.preferredProfessionalId)?.name ?? '' }
        : null,
      note: c.note,
      promotionalConsent: c.promotionalConsent,
      history: all
        .filter((a) => a.startsAt.getTime() <= this.clock.now().getTime() || !ACTIVE_STATUSES.has(a.status))
        .map((a) => ({
          appointmentId: a.id,
          startsAt: a.startsAt.toISOString(),
          status: a.status,
          serviceName: a.snapshot.serviceName,
          professionalName: pros.get(a.professionalId)?.name ?? '',
        })),
      possibleDuplicates: c.anonymizedAt ? [] : await this.duplicatesOf(actor.businessId, c),
      consentHistory: actor.permissions.has('customers.view_all')
        ? (await this.repos.privacy.consentHistory(actor.businessId, c.id)).map((r) => consentEventDto(r, zone))
        : [],
      anonymized: !!c.anonymizedAt,
      notes: (await this.repos.customers.listNotes(actor.businessId, c.id))
        .filter((n) => n.visibility === 'TEAM' || actor.permissions.has('customers.notes_admin'))
        .map((n) => this.noteDto(actor, n, zone)),
    };
  }

  async create(actor: ActorContext, raw: CreateCustomerRequest): Promise<CustomerDetail> {
    requirePermission(actor, 'customers.manage');
    const req = CreateCustomerSchema.parse(raw);
    const { requestId, ...payload } = req;
    const created = await this.idempotency.execute(actor, 'customer.create', requestId, payload, async () => {
      const customer: Customer = {
        id: this.ids.next('cus'),
        businessId: actor.businessId,
        name: req.name,
        phoneE164: normalizePhone(req.phone),
        email: req.email ?? null,
        note: req.note ?? null,
        preferredProfessionalId: null,
        // Tener teléfono o cita no equivale a consentimiento promocional.
        promotionalConsent: req.promotionalConsent ? 'GRANTED' : 'NOT_GRANTED',
        createdAt: this.clock.now(),
      };
      await this.repos.customers.insert(customer);
      if (req.promotionalConsent) {
        await this.repos.privacy.appendConsent({
          id: this.ids.next('cns'),
          businessId: actor.businessId,
          customerId: customer.id,
          status: 'GRANTED',
          source: 'STAFF_APP',
          actorId: actor.userId,
          actorName: actor.userName,
          evidence: 'Aceptó al registrarse',
          at: customer.createdAt,
        });
      }
      return { id: customer.id };
    });
    return this.get(actor, created.id);
  }

  // ── Edición (UI11) ──

  async update(actor: ActorContext, id: string, raw: UpdateCustomerRequest): Promise<CustomerDetail> {
    requirePermission(actor, 'customers.manage');
    const req = UpdateCustomerSchema.parse(raw);
    const { requestId, ...payload } = req;
    await this.idempotency.execute(actor, `customer.update.${id}`, requestId, payload, async () => {
      const c = await this.repos.customers.get(actor.businessId, id);
      if (!c || !isActiveCustomer(c)) throw new DomainError('NOT_FOUND', 'Cliente no encontrado.');
      if (req.preferredProfessionalId) {
        const pros = await this.repos.catalog.professionals(actor.businessId);
        if (!pros.some((p) => p.id === req.preferredProfessionalId && p.active)) {
          throw new DomainError('VALIDATION_ERROR', 'Profesional no disponible.', undefined, { preferredProfessionalId: ['No existe o está inactivo'] });
        }
      }
      await this.repos.customers.update({
        ...c,
        name: req.name,
        phoneE164: normalizePhone(req.phone ?? undefined),
        email: req.email ?? null,
        note: req.note || null,
        preferredProfessionalId: req.preferredProfessionalId,
      });
      return { ok: true };
    });
    return this.get(actor, id);
  }

  // ── Notas internas por rol ──

  private noteDto(actor: ActorContext, n: CustomerNoteRecord, zone: string): CustomerNote {
    return {
      id: n.id,
      body: n.body,
      visibility: n.visibility,
      visibilityLabel: CUSTOMER_NOTE_VISIBILITY_LABELS[n.visibility].title,
      authorName: n.authorName,
      createdAt: toZonedIso(n.createdAt, zone),
      canDelete: n.authorId === actor.userId || actor.permissions.has('customers.notes_admin'),
    };
  }

  /** Cualquiera que pueda ver la ficha puede dejar una nota para el equipo; las restringidas, solo administración. */
  async addNote(actor: ActorContext, customerId: string, raw: CreateCustomerNoteRequest): Promise<CustomerDetail> {
    const req = CreateNoteSchema.parse(raw);
    if (req.visibility === 'ADMINS') requirePermission(actor, 'customers.notes_admin');
    const current = await this.get(actor, customerId); // valida que la ficha sea visible para este actor
    if (current.anonymized) throw new DomainError('POLICY_VIOLATION', 'Los datos de este cliente fueron eliminados.');
    const { requestId, ...payload } = req;
    await this.idempotency.execute(actor, `customer.note.${customerId}`, requestId, payload, async () => {
      await this.repos.customers.saveNote({
        id: this.ids.next('note'),
        businessId: actor.businessId,
        customerId,
        body: req.body,
        visibility: req.visibility,
        authorId: actor.userId,
        authorName: actor.userName,
        createdAt: this.clock.now(),
        deletedAt: null,
      });
      return { ok: true };
    });
    return this.get(actor, customerId);
  }

  async deleteNote(actor: ActorContext, customerId: string, noteId: string, requestId: string): Promise<CustomerDetail> {
    await this.get(actor, customerId);
    await this.idempotency.execute(actor, `customer.note.delete.${noteId}`, requestId, { noteId }, async () => {
      const note = (await this.repos.customers.listNotes(actor.businessId, customerId)).find((n) => n.id === noteId);
      if (!note) throw new DomainError('NOT_FOUND', 'Nota no encontrada.');
      if (note.authorId !== actor.userId && !actor.permissions.has('customers.notes_admin')) {
        throw new DomainError('FORBIDDEN', 'Solo quien escribió la nota o la administración pueden borrarla.');
      }
      await this.repos.customers.saveNote({ ...note, deletedAt: this.clock.now() });
      return { ok: true };
    });
    return this.get(actor, customerId);
  }

  /** Sugerir posibles duplicados por teléfono o nombre normalizado; nunca fusionar solo. */
  private async duplicatesOf(businessId: string, c: Customer) {
    const all = await this.repos.customers.list(businessId);
    return all
      .filter(
        (o) =>
          o.id !== c.id &&
          isActiveCustomer(o) &&
          ((c.phoneE164 && o.phoneE164 === c.phoneE164) || normalizeName(o.name) === normalizeName(c.name)),
      )
      .map((o) => ({ id: o.id, name: o.name }));
  }
}
