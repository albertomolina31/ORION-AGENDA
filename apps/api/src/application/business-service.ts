import type {
  BusinessProfile,
  HomeSummary,
  Integration,
  Professional as ProfessionalDto,
  SchedulesResponse,
  Service as ServiceDto,
} from '@orion/contracts';
import type { Clock } from '../domain/clock.js';
import { DomainError } from '../domain/errors.js';
import { isExpired } from '../domain/lifecycle.js';
import { localDayBounds, toLocalDate } from '../domain/local-time.js';
import type { ActorContext, Business, WeeklyHours } from '../domain/model.js';
import type { AppointmentService } from './appointment-service.js';
import type { Repositories } from './ports.js';
import { categoryLabel, initials } from './presentation.js';

const statusLabel = { CONNECTED: 'Conectado', NOT_CONNECTED: 'Por vincular', ERROR: 'Requiere atención' } as const;

export class BusinessService {
  constructor(
    private readonly repos: Repositories,
    private readonly clock: Clock,
    private readonly appointments: AppointmentService,
  ) {}

  private async business(id: string): Promise<Business> {
    const b = await this.repos.businesses.get(id);
    if (!b) throw new DomainError('NOT_FOUND', 'Negocio no encontrado.');
    return b;
  }

  integrations(b: Business): Integration[] {
    // Estado sin credenciales: nunca se exponen secretos de canal a la app.
    return [
      {
        key: 'WHATSAPP',
        label: 'WhatsApp',
        description: 'Reservas y comunicaciones',
        status: b.integrations.whatsapp === 'ERROR' ? 'ERROR' : b.integrations.whatsapp,
        statusLabel: statusLabel[b.integrations.whatsapp],
      },
      {
        key: 'APPLE_WALLET',
        label: 'Apple Wallet',
        description: 'Tarjetas de fidelidad',
        status: b.integrations.appleWallet,
        statusLabel: statusLabel[b.integrations.appleWallet],
      },
      {
        key: 'GOOGLE_WALLET',
        label: 'Google Wallet',
        description: 'Tarjetas de fidelidad',
        status: b.integrations.googleWallet,
        statusLabel: statusLabel[b.integrations.googleWallet],
      },
    ];
  }

  async profile(actor: ActorContext): Promise<BusinessProfile> {
    const b = await this.business(actor.businessId);
    const [pros, services, links, hours] = await Promise.all([
      this.repos.catalog.professionals(b.id),
      this.repos.catalog.services(b.id),
      this.repos.catalog.professionalServices(b.id),
      this.repos.schedules.professionalHours(b.id),
    ]);
    const activePros = pros.filter((p) => p.active);
    // L02: checklist de activación visible.
    const setupChecklist = [
      { key: 'NAME' as const, label: 'Nombre del negocio', done: b.name.trim().length > 0 },
      { key: 'TIMEZONE' as const, label: 'Zona horaria', done: !!b.timezone },
      { key: 'PROFESSIONAL' as const, label: 'Al menos un profesional activo', done: activePros.length > 0 },
      {
        key: 'SERVICE' as const,
        label: 'Servicio asignado a un profesional',
        done: services.some((s) => s.active && links.some((l) => l.serviceId === s.id)),
      },
      {
        key: 'WORKING_HOURS' as const,
        label: 'Jornada válida',
        done: hours.some((h) => Object.values(h.days).some((d) => d.length > 0)),
      },
      { key: 'POLICY' as const, label: 'Política de confirmación', done: !!b.policy.confirmationMode },
    ];
    return {
      id: b.id,
      name: b.name,
      category: b.category,
      categoryLabel: categoryLabel[b.category],
      timezone: b.timezone,
      currency: b.currency,
      status: b.status,
      acceptingExternalBookings: b.acceptingExternalBookings && setupChecklist.every((i) => i.done),
      policy: b.policy,
      setupChecklist,
      integrations: this.integrations(b),
    };
  }

  async services(actor: ActorContext): Promise<ServiceDto[]> {
    const [services, links] = await Promise.all([
      this.repos.catalog.services(actor.businessId),
      this.repos.catalog.professionalServices(actor.businessId),
    ]);
    return services
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
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

  async professionals(actor: ActorContext): Promise<ProfessionalDto[]> {
    const [pros, links] = await Promise.all([
      this.repos.catalog.professionals(actor.businessId),
      this.repos.catalog.professionalServices(actor.businessId),
    ]);
    const visible = actor.permissions.has('agenda.view_all') ? pros : pros.filter((p) => p.id === actor.professionalId);
    return visible.map((p) => ({
      id: p.id,
      name: p.name,
      initials: initials(p.name),
      colorKey: p.colorKey,
      active: p.active,
      hasUserAccess: p.userId !== null,
      serviceIds: links.filter((l) => l.professionalId === p.id).map((l) => l.serviceId),
    }));
  }

  async schedules(actor: ActorContext): Promise<SchedulesResponse> {
    const b = await this.business(actor.businessId);
    const toDto = (h: WeeklyHours) => ({
      professionalId: h.professionalId,
      days: Object.entries(h.days).map(([weekday, intervals]) => ({ weekday: Number(weekday), intervals })),
    });
    const pros = await this.repos.schedules.professionalHours(b.id);
    const today = toLocalDate(this.clock.now(), b.timezone);
    const exceptions = (await this.repos.schedules.exceptions(b.id, today, '9999-12-31'))
      .filter((e) => e.professionalId === null || actor.permissions.has('agenda.view_all') || e.professionalId === actor.professionalId)
      .sort((x, y) => x.date.localeCompare(y.date));
    return {
      exceptions: exceptions.map((e) => ({ id: e.id, professionalId: e.professionalId, date: e.date, closed: e.closed, intervals: e.intervals, reason: e.reason })),
      timezone: b.timezone,
      business: toDto(await this.repos.schedules.businessHours(b.id)),
      professionals: pros
        .filter((h) => actor.permissions.has('agenda.view_all') || h.professionalId === actor.professionalId)
        .map(toDto),
    };
  }

  /** UI04 Inicio. Cuenta explícitamente qué estados incluye (L13). */
  async home(actor: ActorContext): Promise<HomeSummary> {
    const b = await this.business(actor.businessId);
    const now = this.clock.now();
    const today = toLocalDate(now, b.timezone);
    const agenda = await this.appointments.agenda(actor, { from: today });
    const pending = agenda.appointments.filter((a) => a.status === 'PENDING_APPROVAL');
    const confirmed = agenda.appointments.filter((a) => a.status === 'CONFIRMED');
    // Pendientes por aprobar: incluye solicitudes de otros días (bandeja global).
    const allPending = (await this.repos.appointments.listAll(b.id)).filter(
      (a) =>
        a.status === 'PENDING_APPROVAL' &&
        !isExpired(a, now) &&
        (actor.permissions.has('agenda.view_all') || a.professionalId === actor.professionalId),
    );
    const next = agenda.appointments.find(
      (a) => (a.status === 'CONFIRMED' || a.status === 'PENDING_APPROVAL') && new Date(a.endsAt).getTime() > now.getTime(),
    );
    const pros = await this.repos.catalog.professionals(b.id);
    const whatsapp = this.integrations(b).find((i) => i.key === 'WHATSAPP') ?? null;
    const dayEnd = localDayBounds(today, b.timezone).end;
    return {
      date: today,
      timezone: b.timezone,
      scheduledCount: pending.length + confirmed.length,
      pendingApprovalCount: allPending.length,
      confirmedCount: confirmed.length,
      completedCount: agenda.appointments.filter((a) => a.status === 'COMPLETED').length,
      activeProfessionals: pros.filter((p) => p.active).length,
      nextAppointment: next && new Date(next.startsAt).getTime() < dayEnd ? next : null,
      whatsapp,
      notices:
        b.integrations.whatsapp === 'CONNECTED'
          ? []
          : [{ id: 'wa-off', title: 'WhatsApp sin conectar', body: 'La agenda manual sigue operativa; no se reciben reservas externas.' }],
      generatedAt: now.toISOString(),
    };
  }
}
