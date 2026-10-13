import type { AudienceDefinition, AudiencePreview, Campaign, MessageTemplate, SaveCampaignRequest } from '@orion/contracts';
import { AudienceDefinition as AudienceSchema, SaveCampaignRequest as SaveSchema } from '@orion/contracts';
import type { Clock } from '../domain/clock.js';
import { DomainError } from '../domain/errors.js';
import type { IdGenerator } from '../domain/ids.js';
import { ACTIVE_STATUSES } from '../domain/lifecycle.js';
import { localDateTime } from '../domain/local-time.js';
import type { ActorContext } from '../domain/model.js';
import { requirePermission } from '../domain/permissions.js';
import type { IdempotencyService } from './idempotency-service.js';
import type { LoyaltySimulation } from './loyalty-simulation.js';
import type { Repositories } from './ports.js';

export interface CampaignState {
  campaigns: Array<Campaign & { businessId: string }>;
  templates: Array<MessageTemplate & { businessId: string }>;
}

/**
 * Campañas por WhatsApp (sección 27). UI y backend: Alberto; despacho: Carlos.
 * Aún no se envía nada: la máquina de estados y los límites están pendientes de
 * cerrar con Carlos. Consentimiento y bajas siempre prevalecen.
 */
export class CampaignService {
  constructor(
    readonly state: CampaignState,
    private readonly repos: Repositories,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly idempotency: IdempotencyService,
    private readonly loyalty: LoyaltySimulation,
  ) {}

  list(actor: ActorContext): Campaign[] {
    requirePermission(actor, 'campaigns.view');
    return this.state.campaigns
      .filter((c) => c.businessId === actor.businessId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(({ businessId: _b, ...c }) => c);
  }

  get(actor: ActorContext, id: string): Campaign {
    requirePermission(actor, 'campaigns.view');
    const c = this.state.campaigns.find((x) => x.businessId === actor.businessId && x.id === id);
    if (!c) throw new DomainError('NOT_FOUND', 'Campaña no encontrada.');
    const { businessId: _b, ...rest } = c;
    return rest;
  }

  templates(actor: ActorContext): MessageTemplate[] {
    requirePermission(actor, 'campaigns.view');
    return this.state.templates.filter((t) => t.businessId === actor.businessId).map(({ businessId: _b, ...t }) => t);
  }

  /** Elegibilidad calculada ahora; se revalida antes de cada envío. */
  async previewAudience(actor: ActorContext, raw: AudienceDefinition): Promise<AudiencePreview> {
    requirePermission(actor, 'campaigns.view');
    const def = AudienceSchema.parse(raw);
    const [customers, appts] = await Promise.all([
      this.repos.customers.list(actor.businessId),
      this.repos.appointments.listAll(actor.businessId),
    ]);
    const now = this.clock.now().getTime();
    let matched = customers;
    if (def.mode === 'MANUAL') {
      const ids = new Set(def.customerIds);
      matched = customers.filter((c) => ids.has(c.id));
    } else {
      const memberships = def.segment === 'NEAR_REWARD' ? await this.loyalty.listMemberships(actor) : [];
      matched = customers.filter((c) => {
        const mine = appts.filter((a) => a.customerId === c.id);
        const completed = mine.filter((a) => a.status === 'COMPLETED');
        const last = Math.max(0, ...completed.map((a) => a.startsAt.getTime()));
        const upcoming = mine.some((a) => ACTIVE_STATUSES.has(a.status) && a.startsAt.getTime() > now);
        if (def.excludeWithUpcoming && upcoming) return false;
        switch (def.segment) {
          case 'INACTIVE':
            return completed.length > 0 && now - last > def.inactiveDays * 86_400_000;
          case 'FREQUENT':
            return completed.length >= 3;
          case 'NEAR_REWARD': {
            const m = memberships.find((x) => x.customerId === c.id);
            return !!m && m.stampsRequired - m.stamps <= 2;
          }
        }
      });
    }
    const eligible = matched.filter((c) => c.promotionalConsent === 'GRANTED');
    return {
      matched: matched.length,
      eligible: eligible.length,
      excluded: {
        noConsent: matched.filter((c) => c.promotionalConsent === 'NOT_GRANTED').length,
        optedOut: matched.filter((c) => c.promotionalConsent === 'REVOKED').length,
      },
      sample: eligible.slice(0, 5).map((c) => ({ id: c.id, name: c.name })),
      calculatedAt: new Date(now).toISOString(),
    };
  }

  async save(actor: ActorContext, id: string | null, raw: SaveCampaignRequest): Promise<Campaign> {
    requirePermission(actor, 'campaigns.manage');
    const req = SaveSchema.parse(raw);
    const { requestId, ...payload } = req;
    const saved = await this.idempotency.execute(actor, id ? `campaign.update.${id}` : 'campaign.create', requestId, payload, async () => {
      const now = this.clock.now().toISOString();
      const eligibleCount = req.audience ? (await this.previewAudience(actor, req.audience)).eligible : null;
      if (id) {
        const c = this.state.campaigns.find((x) => x.businessId === actor.businessId && x.id === id);
        if (!c) throw new DomainError('NOT_FOUND', 'Campaña no encontrada.');
        if (c.status !== 'DRAFT') throw new DomainError('INVALID_TRANSITION', 'Solo se editan campañas en borrador.');
        Object.assign(c, {
          name: req.name,
          objective: req.objective,
          audience: req.audience ?? c.audience,
          content: req.content ?? c.content,
          schedule: req.schedule ?? c.schedule,
          eligibleCount: eligibleCount ?? c.eligibleCount,
          updatedAt: now,
        });
        return { id: c.id };
      }
      const c: Campaign & { businessId: string } = {
        id: this.ids.next('cmp'),
        businessId: actor.businessId,
        name: req.name,
        objective: req.objective,
        status: 'DRAFT',
        channel: 'WHATSAPP',
        audience: req.audience ?? null,
        content: req.content ?? null,
        schedule: req.schedule ?? null,
        scheduledAt: null,
        eligibleCount,
        results: null,
        sentAt: null,
        updatedAt: now,
      };
      this.state.campaigns.push(c);
      return { id: c.id };
    });
    return this.get(actor, saved.id);
  }

  /** Programar requiere plantilla aprobada, audiencia, contenido y horario futuro. */
  async confirm(actor: ActorContext, id: string, requestId: string): Promise<Campaign> {
    requirePermission(actor, 'campaigns.manage');
    await this.idempotency.execute(actor, `campaign.confirm.${id}`, requestId, { id }, async () => {
      const c = this.state.campaigns.find((x) => x.businessId === actor.businessId && x.id === id);
      if (!c) throw new DomainError('NOT_FOUND', 'Campaña no encontrada.');
      if (c.status !== 'DRAFT') throw new DomainError('INVALID_TRANSITION', 'La campaña ya no está en borrador.');
      if (!c.audience || !c.content || !c.schedule) {
        throw new DomainError('VALIDATION_ERROR', 'Completa audiencia, mensaje y programación.');
      }
      const template = this.state.templates.find((t) => t.businessId === actor.businessId && t.id === c.content!.templateId);
      if (template?.approval !== 'APPROVED') {
        throw new DomainError('POLICY_VIOLATION', 'La plantilla está pendiente de aprobación; todavía no puedes programarla.');
      }
      const business = await this.repos.businesses.get(actor.businessId);
      const at =
        c.schedule.mode === 'NOW'
          ? this.clock.now()
          : localDateTime(c.schedule.date, c.schedule.time, business!.timezone).toJSDate();
      if (at.getTime() < this.clock.now().getTime() - 60_000) {
        throw new DomainError('VALIDATION_ERROR', 'La fecha de envío ya pasó.');
      }
      // El despacho real lo hará el adaptador de Carlos; aquí solo cambia el estado.
      c.status = 'SCHEDULED';
      c.scheduledAt = at.toISOString();
      c.updatedAt = this.clock.now().toISOString();
      return { id };
    });
    return this.get(actor, id);
  }
}
