import type {
  AnonymizeCustomerRequest,
  ConsentEvent,
  CreatePrivacyRequest,
  CustomerDataExport,
  CustomerDetail,
  PrivacyOverview,
  PrivacyRequest,
  PrivacyRequestAction,
  PrivacyRequestTransition,
  UpdateConsentRequest,
} from '@orion/contracts';
import {
  ANONYMIZED_CUSTOMER_NAME,
  AnonymizeCustomerRequest as AnonymizeSchema,
  CONSENT_SOURCE_LABELS,
  CONSENT_STATUS_LABELS,
  CreatePrivacyRequest as CreateRequestSchema,
  PRIVACY_CHANNEL_LABELS,
  PRIVACY_REQUEST_STATUS_LABELS,
  PRIVACY_REQUEST_TYPE_LABELS,
  PrivacyRequestTransition as TransitionSchema,
  UpdateConsentRequest as ConsentSchema,
} from '@orion/contracts';
import type { Clock } from '../domain/clock.js';
import { DomainError } from '../domain/errors.js';
import type { IdGenerator } from '../domain/ids.js';
import { ACTIVE_STATUSES } from '../domain/lifecycle.js';
import { toZonedIso } from '../domain/local-time.js';
import type { ActorContext, ConsentRecord, Customer, PrivacyRequestRecord } from '../domain/model.js';
import { requirePermission } from '../domain/permissions.js';
import type { IdempotencyService } from './idempotency-service.js';
import type { Repositories } from './ports.js';

const DAY_MS = 86_400_000;

/** Políticas que el código NO decide: requieren revisión especializada (sección 14). */
export const PENDING_PRIVACY_POLICIES = [
  'Plazo legal para responder cada tipo de solicitud.',
  'Tiempo de conservación de citas e importes de clientes eliminados.',
  'Aviso de privacidad y texto de consentimiento promocional.',
  'Verificación de identidad de quien hace la solicitud.',
];

export function consentEventDto(r: ConsentRecord, zone: string): ConsentEvent {
  return {
    id: r.id,
    at: toZonedIso(r.at, zone),
    status: r.status,
    statusLabel: CONSENT_STATUS_LABELS[r.status],
    source: r.source,
    sourceLabel: CONSENT_SOURCE_LABELS[r.source],
    actorName: r.actorName,
    evidence: r.evidence,
  };
}

/**
 * Privacidad y datos: consentimiento con historial, solicitudes de derechos (acceso,
 * rectificación, cancelación, oposición), exportación y eliminación de datos personales.
 * La eliminación anonimiza: no borra citas ni importes (no eliminar clientes con historia).
 */
export class PrivacyService {
  constructor(
    private readonly repos: Repositories,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly idempotency: IdempotencyService,
    private readonly customerDetail: (actor: ActorContext, id: string) => Promise<CustomerDetail>,
  ) {}

  private async zone(businessId: string): Promise<string> {
    return (await this.repos.businesses.get(businessId))?.timezone ?? 'UTC';
  }

  private async customer(businessId: string, id: string): Promise<Customer> {
    const c = await this.repos.customers.get(businessId, id);
    if (!c) throw new DomainError('NOT_FOUND', 'Cliente no encontrado.');
    return c;
  }

  // ── Consentimiento ──

  async updateConsent(actor: ActorContext, customerId: string, raw: UpdateConsentRequest): Promise<CustomerDetail> {
    requirePermission(actor, 'customers.manage');
    const req = ConsentSchema.parse(raw);
    const { requestId, ...payload } = req;
    await this.idempotency.execute(actor, `customer.consent.${customerId}`, requestId, payload, async () => {
      const c = await this.customer(actor.businessId, customerId);
      if (c.anonymizedAt) throw new DomainError('POLICY_VIOLATION', 'Los datos de este cliente fueron eliminados.');
      if (c.promotionalConsent === req.status) return { unchanged: true };
      await this.recordConsent(actor, c, req.status, req.source, req.evidence ?? null);
      return { ok: true };
    });
    return this.customerDetail(actor, customerId);
  }

  private async recordConsent(actor: ActorContext, c: Customer, status: ConsentRecord['status'], source: ConsentRecord['source'], evidence: string | null) {
    const now = this.clock.now();
    await this.repos.customers.update({ ...c, promotionalConsent: status });
    await this.repos.privacy.appendConsent({
      id: this.ids.next('cns'),
      businessId: c.businessId,
      customerId: c.id,
      status,
      source,
      actorId: actor.userId,
      actorName: actor.userName,
      evidence,
      at: now,
    });
    await this.repos.outbox.append({
      eventId: this.ids.next('evt'),
      eventType: 'customer.consent_changed',
      schemaVersion: 1,
      occurredAt: now,
      businessId: c.businessId,
      aggregateId: c.id,
      aggregateVersion: 1,
      correlationId: actor.correlationId,
      payload: { customerId: c.id, status },
      status: 'PENDING',
      attempts: 0,
      actorId: actor.userId,
    });
  }

  // ── Solicitudes de derechos ──

  private blocker(r: PrivacyRequestRecord, c: Customer): string | null {
    if (r.status === 'COMPLETED' || r.status === 'REJECTED') return null;
    if (r.type === 'CANCELLATION' && !c.anonymizedAt) return 'Primero elimina los datos del cliente.';
    return null;
  }

  private toDto(r: PrivacyRequestRecord, c: Customer, zone: string): PrivacyRequest {
    const open = r.status === 'RECEIVED' || r.status === 'IN_PROGRESS';
    const end = r.resolvedAt ?? this.clock.now();
    const blocker = this.blocker(r, c);
    return {
      id: r.id,
      customer: { id: c.id, name: c.name, anonymized: !!c.anonymizedAt },
      type: r.type,
      typeLabel: PRIVACY_REQUEST_TYPE_LABELS[r.type].title,
      status: r.status,
      statusLabel: PRIVACY_REQUEST_STATUS_LABELS[r.status],
      channel: r.channel,
      channelLabel: PRIVACY_CHANNEL_LABELS[r.channel],
      details: r.details,
      receivedAt: toZonedIso(r.receivedAt, zone),
      daysOpen: Math.max(0, Math.floor((end.getTime() - r.receivedAt.getTime()) / DAY_MS)),
      resolvedAt: r.resolvedAt ? toZonedIso(r.resolvedAt, zone) : null,
      resolution: r.resolution,
      history: r.history.map((h) => ({ at: toZonedIso(h.at, zone), status: h.status, statusLabel: PRIVACY_REQUEST_STATUS_LABELS[h.status], actorName: h.actorName, note: h.note })),
      allowedActions: !open ? [] : r.status === 'RECEIVED' ? ['start', 'complete', 'reject'] : ['complete', 'reject'],
      completionBlocker: blocker,
    };
  }

  async overview(actor: ActorContext): Promise<PrivacyOverview> {
    requirePermission(actor, 'privacy.manage');
    const [customers, requests, consents, zone] = await Promise.all([
      this.repos.customers.list(actor.businessId),
      this.repos.privacy.listRequests(actor.businessId),
      this.repos.privacy.consentHistory(actor.businessId),
      this.zone(actor.businessId),
    ]);
    const byId = new Map(customers.map((c) => [c.id, c]));
    const active = customers.filter((c) => !c.anonymizedAt);
    const dtos = requests
      .filter((r) => byId.has(r.customerId))
      .map((r) => this.toDto(r, byId.get(r.customerId)!, zone));
    const isOpen = (r: PrivacyRequest) => r.status === 'RECEIVED' || r.status === 'IN_PROGRESS';
    return {
      consent: {
        granted: active.filter((c) => c.promotionalConsent === 'GRANTED').length,
        notGranted: active.filter((c) => c.promotionalConsent === 'NOT_GRANTED').length,
        revoked: active.filter((c) => c.promotionalConsent === 'REVOKED').length,
      },
      openRequests: dtos.filter(isOpen).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)),
      closedRequests: dtos
        .filter((r) => !isOpen(r))
        .sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''))
        .slice(0, 10),
      recentConsentChanges: consents.slice(0, 10).map((r) => ({
        ...consentEventDto(r, zone),
        customerId: r.customerId,
        customerName: byId.get(r.customerId)?.name ?? 'Cliente',
      })),
      pendingPolicies: PENDING_PRIVACY_POLICIES,
    };
  }

  async getRequest(actor: ActorContext, id: string): Promise<PrivacyRequest> {
    requirePermission(actor, 'privacy.manage');
    const r = await this.repos.privacy.getRequest(actor.businessId, id);
    if (!r) throw new DomainError('NOT_FOUND', 'Solicitud no encontrada.');
    return this.toDto(r, await this.customer(actor.businessId, r.customerId), await this.zone(actor.businessId));
  }

  async createRequest(actor: ActorContext, raw: CreatePrivacyRequest): Promise<PrivacyRequest> {
    requirePermission(actor, 'privacy.manage');
    const req = CreateRequestSchema.parse(raw);
    const { requestId, ...payload } = req;
    const created = await this.idempotency.execute(actor, 'privacy.request.create', requestId, payload, async () => {
      const c = await this.customer(actor.businessId, req.customerId);
      if (c.anonymizedAt) throw new DomainError('POLICY_VIOLATION', 'Los datos de este cliente ya fueron eliminados.');
      const now = this.clock.now();
      const r: PrivacyRequestRecord = {
        id: this.ids.next('prv'),
        businessId: actor.businessId,
        customerId: c.id,
        type: req.type,
        status: 'RECEIVED',
        channel: req.channel,
        details: req.details || null,
        receivedAt: now,
        resolvedAt: null,
        resolution: null,
        history: [{ at: now, status: 'RECEIVED', actorName: actor.userName, note: null }],
      };
      await this.repos.privacy.saveRequest(r);
      return { id: r.id };
    });
    return this.getRequest(actor, created.id);
  }

  async transition(actor: ActorContext, id: string, action: PrivacyRequestAction, raw: PrivacyRequestTransition): Promise<PrivacyRequest> {
    requirePermission(actor, 'privacy.manage');
    const req = TransitionSchema.parse(raw);
    const { requestId, ...payload } = req;
    await this.idempotency.execute(actor, `privacy.request.${action}.${id}`, requestId, payload, async () => {
      const r = await this.repos.privacy.getRequest(actor.businessId, id);
      if (!r) throw new DomainError('NOT_FOUND', 'Solicitud no encontrada.');
      const c = await this.customer(actor.businessId, r.customerId);
      const dto = this.toDto(r, c, 'UTC');
      if (!dto.allowedActions.includes(action)) {
        throw new DomainError('INVALID_TRANSITION', `La solicitud ya está ${dto.statusLabel.toLowerCase()}.`);
      }
      const note = req.note?.trim() || null;
      if (action !== 'start' && (!note || note.length < 3)) {
        throw new DomainError('VALIDATION_ERROR', 'Escribe la respuesta que se dio al cliente.', undefined, { note: ['Obligatorio'] });
      }
      if (action === 'complete') {
        const blocker = this.blocker(r, c);
        if (blocker) throw new DomainError('POLICY_VIOLATION', blocker);
        // Oposición atendida: el cliente deja de recibir promociones (baja registrada).
        if (r.type === 'OPPOSITION' && c.promotionalConsent !== 'REVOKED') {
          await this.recordConsent(actor, c, 'REVOKED', 'CUSTOMER_REQUEST', `Solicitud de oposición ${r.id}`);
        }
      }
      const now = this.clock.now();
      const status = action === 'start' ? 'IN_PROGRESS' : action === 'complete' ? 'COMPLETED' : 'REJECTED';
      await this.repos.privacy.saveRequest({
        ...r,
        status,
        resolvedAt: action === 'start' ? null : now,
        resolution: action === 'start' ? r.resolution : note,
        history: [...r.history, { at: now, status, actorName: actor.userName, note }],
      });
      return { ok: true };
    });
    return this.getRequest(actor, id);
  }

  // ── Exportación y eliminación ──

  async exportCustomer(actor: ActorContext, customerId: string): Promise<CustomerDataExport> {
    requirePermission(actor, 'privacy.manage');
    const [c, business, appts, pros, consents, requests] = await Promise.all([
      this.customer(actor.businessId, customerId),
      this.repos.businesses.get(actor.businessId),
      this.repos.appointments.listByCustomer(actor.businessId, customerId),
      this.repos.catalog.professionals(actor.businessId),
      this.repos.privacy.consentHistory(actor.businessId, customerId),
      this.repos.privacy.listRequests(actor.businessId),
    ]);
    const zone = business?.timezone ?? 'UTC';
    const proName = new Map(pros.map((p) => [p.id, p.name]));
    return {
      format: 'orion.customer-export.v1',
      exportedAt: toZonedIso(this.clock.now(), zone),
      exportedBy: actor.userName,
      business: { id: actor.businessId, name: business?.name ?? '' },
      customer: {
        id: c.id,
        name: c.name,
        phone: c.phoneE164,
        email: c.email,
        note: c.note,
        customerSince: toZonedIso(c.createdAt, zone),
        promotionalConsent: c.promotionalConsent,
        anonymized: !!c.anonymizedAt,
      },
      consentHistory: consents.map((r) => consentEventDto(r, zone)),
      appointments: appts
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
        .map((a) => ({
          startsAt: toZonedIso(a.startsAt, zone),
          status: a.status,
          serviceName: a.snapshot.serviceName,
          professionalName: proName.get(a.professionalId) ?? '',
          price: { amountMinor: a.snapshot.priceMinor, currency: a.snapshot.currency },
        })),
      privacyRequests: requests
        .filter((r) => r.customerId === customerId)
        .map((r) => ({ type: r.type, status: r.status, receivedAt: toZonedIso(r.receivedAt, zone), resolvedAt: r.resolvedAt ? toZonedIso(r.resolvedAt, zone) : null })),
    };
  }

  async anonymize(actor: ActorContext, customerId: string, raw: AnonymizeCustomerRequest): Promise<CustomerDetail> {
    requirePermission(actor, 'privacy.manage');
    const req = AnonymizeSchema.parse(raw);
    const { requestId, ...payload } = req;
    await this.idempotency.execute(actor, `customer.anonymize.${customerId}`, requestId, payload, async () => {
      const c = await this.customer(actor.businessId, customerId);
      if (c.anonymizedAt) return { already: true };
      if (req.confirmName.toLocaleLowerCase('es-MX') !== c.name.trim().toLocaleLowerCase('es-MX')) {
        throw new DomainError('VALIDATION_ERROR', 'El nombre no coincide con el del cliente.', undefined, { confirmName: ['No coincide'] });
      }
      const now = this.clock.now().getTime();
      const future = (await this.repos.appointments.listByCustomer(actor.businessId, customerId)).filter(
        (a) => ACTIVE_STATUSES.has(a.status) && a.endsAt.getTime() > now,
      );
      if (future.length > 0) {
        throw new DomainError(
          'POLICY_VIOLATION',
          `El cliente tiene ${future.length === 1 ? 'una cita próxima' : `${future.length} citas próximas`}. Cancélalas antes de eliminar sus datos.`,
          { futureAppointmentIds: future.map((a) => a.id) },
        );
      }
      if (req.privacyRequestId) {
        const r = await this.repos.privacy.getRequest(actor.businessId, req.privacyRequestId);
        if (!r || r.customerId !== customerId || r.type !== 'CANCELLATION') {
          throw new DomainError('VALIDATION_ERROR', 'La solicitud indicada no es una cancelación de este cliente.');
        }
      }
      if (c.promotionalConsent !== 'REVOKED') {
        await this.recordConsent(actor, c, 'REVOKED', 'SYSTEM', 'Datos eliminados por solicitud del cliente');
      }
      // Se conservan citas, importes y sellos sin identificar a la persona.
      await this.repos.customers.update({
        ...c,
        name: ANONYMIZED_CUSTOMER_NAME,
        phoneE164: null,
        email: null,
        note: null,
        preferredProfessionalId: null,
        promotionalConsent: 'REVOKED',
        anonymizedAt: this.clock.now(),
      });
      return { ok: true };
    });
    return this.customerDetail(actor, customerId);
  }
}
