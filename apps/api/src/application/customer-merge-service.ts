import type { ConsentStatus, CustomerDetail, MergeCustomersRequest, MergePreview } from '@orion/contracts';
import { MergeCustomersRequest as MergeSchema } from '@orion/contracts';
import type { Clock } from '../domain/clock.js';
import { DomainError } from '../domain/errors.js';
import type { IdGenerator } from '../domain/ids.js';
import { type ActorContext, type Customer, isActiveCustomer } from '../domain/model.js';
import { requirePermission } from '../domain/permissions.js';
import type { IdempotencyService } from './idempotency-service.js';
import type { LoyaltySimulation } from './loyalty-simulation.js';
import type { Repositories } from './ports.js';
import { maskPhone } from './presentation.js';

/**
 * Unir clientes duplicados (sección 25: "no fusionar automáticamente"). Siempre lo decide
 * una persona con permiso, con vista previa de lo que pasará. Se preservan citas (con su
 * historial), notas, consentimientos, solicitudes de datos y la tarjeta de fidelidad.
 * Si ambos tienen tarjeta, NO se une: combinar sellos es una regla del módulo de
 * fidelidad (Sergio) que aún no está definida.
 */
export class CustomerMergeService {
  constructor(
    private readonly repos: Repositories,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly idempotency: IdempotencyService,
    private readonly loyalty: LoyaltySimulation,
    private readonly customerDetail: (actor: ActorContext, id: string) => Promise<CustomerDetail>,
  ) {}

  private async pair(businessId: string, survivorId: string, duplicateId: string): Promise<[Customer, Customer]> {
    if (survivorId === duplicateId) throw new DomainError('VALIDATION_ERROR', 'Elige dos clientes distintos.');
    const [a, b] = await Promise.all([this.repos.customers.get(businessId, survivorId), this.repos.customers.get(businessId, duplicateId)]);
    if (!a || !b || !isActiveCustomer(a) || !isActiveCustomer(b)) throw new DomainError('NOT_FOUND', 'Cliente no encontrado.');
    return [a, b];
  }

  /** La baja prevalece: si alguno se dio de baja, el resultado es baja. */
  private consentOf(a: ConsentStatus, b: ConsentStatus): { status: ConsentStatus; explanation: string } {
    if (a === 'REVOKED' || b === 'REVOKED') return { status: 'REVOKED', explanation: 'Uno de los registros se dio de baja de promociones: la baja se conserva.' };
    if (a === 'GRANTED' || b === 'GRANTED') return { status: 'GRANTED', explanation: 'Uno de los registros aceptó promociones con constancia; se conserva su historial.' };
    return { status: 'NOT_GRANTED', explanation: 'Ninguno de los dos aceptó promociones.' };
  }

  private loyaltyOf(businessId: string, a: string, b: string) {
    const ms = this.loyalty.state.memberships.filter((m) => m.businessId === businessId);
    const ma = ms.find((m) => m.customerId === a);
    const mb = ms.find((m) => m.customerId === b);
    if (ma && mb) return { kind: 'BLOCKED' as const, membership: mb };
    if (mb) return { kind: 'MOVE' as const, membership: mb };
    return { kind: 'NONE' as const, membership: undefined };
  }

  async preview(actor: ActorContext, survivorId: string, duplicateId: string): Promise<MergePreview> {
    requirePermission(actor, 'customers.merge');
    const [survivor, duplicate] = await this.pair(actor.businessId, survivorId, duplicateId);
    const [apptsA, apptsB, notesB] = await Promise.all([
      this.repos.appointments.listByCustomer(actor.businessId, survivor.id),
      this.repos.appointments.listByCustomer(actor.businessId, duplicate.id),
      this.repos.customers.listNotes(actor.businessId, duplicate.id),
    ]);
    const fill: string[] = [];
    if (!survivor.phoneE164 && duplicate.phoneE164) fill.push('Teléfono');
    if (!survivor.email && duplicate.email) fill.push('Correo');
    if (!survivor.note && duplicate.note) fill.push('Nota operativa');
    if (!survivor.preferredProfessionalId && duplicate.preferredProfessionalId) fill.push('Profesional preferido');
    const consent = this.consentOf(survivor.promotionalConsent, duplicate.promotionalConsent);
    const loyalty = this.loyaltyOf(actor.businessId, survivor.id, duplicate.id);
    const visits = (list: typeof apptsA) => list.filter((x) => x.status === 'COMPLETED').length;
    return {
      survivor: { id: survivor.id, name: survivor.name, phoneMasked: maskPhone(survivor.phoneE164), completedVisits: visits(apptsA) },
      duplicate: { id: duplicate.id, name: duplicate.name, phoneMasked: maskPhone(duplicate.phoneE164), completedVisits: visits(apptsB) },
      appointmentsToMove: apptsB.length,
      notesToMove: notesB.length,
      fieldsFilled: fill,
      consentResult: consent.status,
      consentExplanation: consent.explanation,
      loyalty: loyalty.kind,
      blockedReason:
        loyalty.kind === 'BLOCKED'
          ? 'Ambos tienen tarjeta de fidelidad. Combinar sellos depende de las reglas del módulo de fidelidad (pendiente con Sergio).'
          : null,
    };
  }

  async merge(actor: ActorContext, survivorId: string, raw: MergeCustomersRequest): Promise<CustomerDetail> {
    requirePermission(actor, 'customers.merge');
    const req = MergeSchema.parse(raw);
    const { requestId, ...payload } = req;
    await this.idempotency.execute(actor, `customer.merge.${survivorId}`, requestId, payload, async () => {
      const preview = await this.preview(actor, survivorId, req.duplicateId);
      if (preview.blockedReason) throw new DomainError('POLICY_VIOLATION', preview.blockedReason);
      const [survivor, duplicate] = await this.pair(actor.businessId, survivorId, req.duplicateId);
      const now = this.clock.now();

      // 1) Citas: pasan al cliente que se conserva, con versión nueva y constancia en su historial.
      for (const appt of await this.repos.appointments.listByCustomer(actor.businessId, duplicate.id)) {
        await this.repos.appointments.update({ ...appt, customerId: survivor.id, version: appt.version + 1 }, appt.version);
        await this.repos.history.append({
          appointmentId: appt.id,
          businessId: actor.businessId,
          at: now,
          fromStatus: appt.status,
          toStatus: appt.status,
          action: 'customer_merged',
          actorId: actor.userId,
          actorName: actor.userName,
          reason: `Cliente unificado: "${duplicate.name}" → "${survivor.name}"`,
          previousStartsAt: null,
        });
      }
      // 2) Notas, consentimientos y solicitudes de datos.
      await this.repos.customers.reassignNotes(actor.businessId, duplicate.id, survivor.id);
      await this.repos.privacy.reassignCustomer(actor.businessId, duplicate.id, survivor.id);
      // 3) Fidelidad (simulación): solo se mueve si el que se conserva no tiene tarjeta.
      const loyalty = this.loyaltyOf(actor.businessId, survivor.id, duplicate.id);
      if (loyalty.kind === 'MOVE') loyalty.membership.customerId = survivor.id;
      // 4) Datos: se completan los vacíos; el consentimiento sigue la regla "la baja prevalece".
      const consent = this.consentOf(survivor.promotionalConsent, duplicate.promotionalConsent);
      await this.repos.customers.update({
        ...survivor,
        phoneE164: survivor.phoneE164 ?? duplicate.phoneE164,
        email: survivor.email ?? duplicate.email,
        note: survivor.note ?? duplicate.note,
        preferredProfessionalId: survivor.preferredProfessionalId ?? duplicate.preferredProfessionalId,
        promotionalConsent: consent.status,
        createdAt: survivor.createdAt < duplicate.createdAt ? survivor.createdAt : duplicate.createdAt,
      });
      if (consent.status !== survivor.promotionalConsent) {
        await this.repos.privacy.appendConsent({
          id: this.ids.next('cns'),
          businessId: actor.businessId,
          customerId: survivor.id,
          status: consent.status,
          source: 'SYSTEM',
          actorId: actor.userId,
          actorName: actor.userName,
          evidence: `Unión con el registro duplicado "${duplicate.name}"`,
          at: now,
        });
      }
      await this.repos.customers.update({ ...duplicate, mergedIntoId: survivor.id, mergedAt: now });
      await this.repos.outbox.append({
        eventId: this.ids.next('evt'),
        eventType: 'customer.merged',
        schemaVersion: 1,
        occurredAt: now,
        businessId: actor.businessId,
        aggregateId: survivor.id,
        aggregateVersion: 1,
        correlationId: actor.correlationId,
        payload: { survivorId: survivor.id, duplicateId: duplicate.id, appointmentsMoved: preview.appointmentsToMove },
        status: 'PENDING',
        attempts: 0,
        actorId: actor.userId,
      });
      return { ok: true };
    });
    return this.customerDetail(actor, survivorId);
  }
}
