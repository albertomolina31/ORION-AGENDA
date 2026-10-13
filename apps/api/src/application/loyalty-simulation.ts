import type { LoyaltyMembership, LoyaltyProgram, RedeemRequest, RedemptionResult } from '@orion/contracts';
import type { Clock } from '../domain/clock.js';
import { DomainError } from '../domain/errors.js';
import type { IdGenerator } from '../domain/ids.js';
import type { ActorContext, OutboxEvent } from '../domain/model.js';
import { requirePermission } from '../domain/permissions.js';
import type { IdempotencyService } from './idempotency-service.js';
import type { Repositories } from './ports.js';

/**
 * ⚠️ SIMULACIÓN del módulo de fidelidad (propietario: Sergio).
 * Sirve como fixture del contrato para que la app y el núcleo integren por eventos.
 * Las reglas reales (programa versionado, ledger, canje, Wallet) las define Sergio;
 * 7 sellos y 20 % son valores de ejemplo, no reglas fijas.
 */
export interface LoyaltySimState {
  programs: LoyaltyProgram[];
  memberships: Array<{ id: string; businessId: string; customerId: string; stamps: number; passUpdate: LoyaltyMembership['passUpdate'] }>;
  /** Ledger inmutable; unicidad por programa + cita. */
  ledger: Array<{ id: string; programId: string; membershipId: string; appointmentId: string | null; delta: number; at: Date; reason: string }>;
  processedEvents: Set<string>;
  rewards: Array<{
    id: string;
    businessId: string;
    membershipId: string;
    description: string;
    serviceName: string | null;
    status: 'AVAILABLE' | 'REDEEMED' | 'EXPIRED';
    validUntil: Date;
  }>;
}

export class LoyaltySimulation {
  constructor(
    readonly state: LoyaltySimState,
    private readonly repos: Repositories,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly idempotency: IdempotencyService,
  ) {}

  private program(businessId: string): LoyaltyProgram {
    const p = this.state.programs.find((x) => x.businessId === businessId);
    if (!p) throw new DomainError('NOT_FOUND', 'Este negocio no tiene programa de fidelidad.');
    return p;
  }

  getProgram(actor: ActorContext): LoyaltyProgram {
    requirePermission(actor, 'loyalty.view');
    return this.program(actor.businessId);
  }

  async listMemberships(actor: ActorContext): Promise<LoyaltyMembership[]> {
    requirePermission(actor, 'loyalty.view');
    const customers = new Map((await this.repos.customers.list(actor.businessId)).map((c) => [c.id, c]));
    return this.state.memberships
      .filter((m) => m.businessId === actor.businessId)
      .map((m) => this.toDto(m, customers.get(m.customerId)?.name ?? 'Cliente'))
      .sort((a, b) => b.stamps - a.stamps);
  }

  async membershipForCustomer(actor: ActorContext, customerId: string): Promise<LoyaltyMembership | null> {
    requirePermission(actor, 'loyalty.view');
    const customer = await this.repos.customers.get(actor.businessId, customerId);
    if (!customer) throw new DomainError('NOT_FOUND', 'Cliente no encontrado.');
    const m = this.state.memberships.find((x) => x.businessId === actor.businessId && x.customerId === customerId);
    return m ? this.toDto(m, customer.name) : null;
  }

  /** Canje: idempotente y atómico; dos empleados intentando canjear producen un solo canje. */
  async redeem(actor: ActorContext, req: RedeemRequest): Promise<RedemptionResult> {
    requirePermission(actor, 'loyalty.redeem');
    const { requestId, ...payload } = req;
    return this.idempotency.execute(actor, 'loyalty.redeem', requestId, payload, async () => {
      const reward = this.state.rewards.find((r) => r.businessId === actor.businessId && r.id === req.rewardId);
      if (!reward) throw new DomainError('NOT_FOUND', 'Recompensa no encontrada.');
      const now = this.clock.now();
      if (reward.status === 'AVAILABLE' && reward.validUntil.getTime() <= now.getTime()) reward.status = 'EXPIRED';
      if (reward.status !== 'AVAILABLE') {
        throw new DomainError('INVALID_TRANSITION', reward.status === 'REDEEMED' ? 'La recompensa ya fue utilizada.' : 'La recompensa venció.');
      }
      reward.status = 'REDEEMED';
      return { redemptionId: this.ids.next('rdm'), rewardId: reward.id, status: 'REDEEMED' as const, redeemedAt: now.toISOString() };
    });
  }

  /**
   * Consumidor de appointment.completed (entrega al menos una vez, consumo idempotente).
   * No inscribe automáticamente: sin afiliación no hay sello.
   */
  async consume(event: OutboxEvent): Promise<void> {
    if (event.eventType !== 'appointment.completed') return;
    if (this.state.processedEvents.has(event.eventId)) return;
    this.state.processedEvents.add(event.eventId);
    const p = event.payload as { appointmentId: string; customerId: string; serviceId: string };
    const program = this.state.programs.find((x) => x.businessId === event.businessId && x.status === 'ACTIVE');
    if (!program || !program.eligibleServiceIds.includes(p.serviceId)) return;
    const m = this.state.memberships.find((x) => x.businessId === event.businessId && x.customerId === p.customerId);
    if (!m) return;
    // Unicidad por programa + cita: un evento repetido con otro ID tampoco suma.
    if (this.state.ledger.some((l) => l.programId === program.id && l.appointmentId === p.appointmentId)) return;
    this.state.ledger.push({
      id: this.ids.next('led'),
      programId: program.id,
      membershipId: m.id,
      appointmentId: p.appointmentId,
      delta: 1,
      at: this.clock.now(),
      reason: 'Visita completada',
    });
    m.stamps += 1;
    m.passUpdate = 'PENDING';
    if (m.stamps >= program.stampsRequired) {
      m.stamps -= program.stampsRequired;
      this.state.rewards.push({
        id: this.ids.next('rwd'),
        businessId: event.businessId,
        membershipId: m.id,
        description: program.reward.description,
        serviceName: null,
        status: 'AVAILABLE',
        validUntil: new Date(this.clock.now().getTime() + program.rewardValidityDays * 86_400_000),
      });
    }
  }

  private toDto(m: LoyaltySimState['memberships'][number], customerName: string): LoyaltyMembership {
    const program = this.program(m.businessId);
    return {
      id: m.id,
      customerId: m.customerId,
      customerName,
      stamps: m.stamps,
      stampsRequired: program.stampsRequired,
      passUpdate: m.passUpdate,
      availableRewards: this.state.rewards
        .filter((r) => r.membershipId === m.id)
        .map((r) => ({
          id: r.id,
          description: r.description,
          serviceName: r.serviceName,
          status: r.status,
          validUntil: r.validUntil.toISOString(),
        })),
    };
  }
}
