import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  AgendaQuery,
  AppointmentStatus,
  AudienceDefinition,
  AvailabilityQuery,
  ConfirmCampaignRequest,
  CreateAppointmentRequest,
  CreateCustomerRequest,
  CustomerListQuery,
  DevLoginRequest,
  RedeemRequest,
  RescheduleRequest,
  SaveCampaignRequest,
  TransitionRequest,
} from '@orion/contracts';
import { z } from 'zod';
import type { OrionContainer } from '../container.js';
import type { ActorContext } from '../domain/model.js';
import { AuthGuard, BusinessGuard } from './guards.js';
import { Actor, type OrionRequest, UserId } from './request-context.js';
import type { SimulatedSessionStore } from './sessions.js';
import { CONTAINER, SESSIONS } from './tokens.js';
import { ZodPipe } from './zod-pipe.js';
import { DomainError } from '../domain/errors.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(CONTAINER) private readonly c: OrionContainer,
    @Inject(SESSIONS) private readonly sessions: SimulatedSessionStore,
  ) {}

  /** Selector de usuarios sintéticos para el login simulado. */
  @Get('dev-users')
  devUsers() {
    return this.c.access.devUsers();
  }

  @Post('dev-login')
  @HttpCode(200)
  async devLogin(@Body(new ZodPipe(DevLoginRequest)) body: DevLoginRequest) {
    const me = await this.c.access.me(body.userId).catch(() => {
      throw new DomainError('UNAUTHENTICATED', 'Usuario de prueba no válido.');
    });
    return { accessToken: this.sessions.issue(body.userId), user: me.user, authMode: 'SIMULATED' as const };
  }

  /** Cerrar sesión revoca el token (la app además limpia caché y datos privados). */
  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  logout(@Req() req: OrionRequest) {
    if (req.token) this.sessions.revoke(req.token);
  }
}

@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(@Inject(CONTAINER) private readonly c: OrionContainer) {}

  @Get()
  me(@UserId() userId: string) {
    return this.c.access.me(userId);
  }

  @Get('businesses')
  async businesses(@UserId() userId: string) {
    return (await this.c.access.me(userId)).memberships;
  }
}

@Controller('operations')
@UseGuards(AuthGuard)
export class OperationsController {
  constructor(@Inject(CONTAINER) private readonly c: OrionContainer) {}

  /** Resolver un timeout sin duplicar. */
  @Get(':requestId')
  get(@UserId() userId: string, @Param('requestId') requestId: string) {
    return this.c.idempotency.operation(userId, requestId);
  }
}

@Controller('businesses/:businessId')
@UseGuards(BusinessGuard)
export class BusinessController {
  constructor(@Inject(CONTAINER) private readonly c: OrionContainer) {}

  @Get()
  profile(@Actor() a: ActorContext) {
    return this.c.business.profile(a);
  }

  @Get('home')
  home(@Actor() a: ActorContext) {
    return this.c.business.home(a);
  }

  @Get('services')
  services(@Actor() a: ActorContext) {
    return this.c.business.services(a);
  }

  @Get('professionals')
  professionals(@Actor() a: ActorContext) {
    return this.c.business.professionals(a);
  }

  @Get('schedules')
  schedules(@Actor() a: ActorContext) {
    return this.c.business.schedules(a);
  }

  @Get('integrations')
  async integrations(@Actor() a: ActorContext) {
    return (await this.c.business.profile(a)).integrations;
  }

  @Get('availability')
  availability(@Actor() a: ActorContext, @Query(new ZodPipe(AvailabilityQuery)) q: AvailabilityQuery) {
    return this.c.appointments.availability(a, q);
  }
}

const AgendaQueryFromUrl = AgendaQuery.extend({
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',') : undefined))
    .pipe(z.array(AppointmentStatus).optional()),
});

const TransitionAction = z.enum(['approve', 'reject', 'cancel', 'complete', 'no-show']);

@Controller('businesses/:businessId/appointments')
@UseGuards(BusinessGuard)
export class AppointmentsController {
  constructor(@Inject(CONTAINER) private readonly c: OrionContainer) {}

  @Get()
  list(@Actor() a: ActorContext, @Query(new ZodPipe(AgendaQueryFromUrl)) q: AgendaQuery) {
    return this.c.appointments.agenda(a, q);
  }

  @Post()
  @HttpCode(201)
  create(@Actor() a: ActorContext, @Body(new ZodPipe(CreateAppointmentRequest)) body: CreateAppointmentRequest) {
    return this.c.appointments.create(a, body);
  }

  @Get(':appointmentId')
  get(@Actor() a: ActorContext, @Param('appointmentId') id: string) {
    return this.c.appointments.get(a, id);
  }

  @Post(':appointmentId/reschedule')
  @HttpCode(200)
  reschedule(@Actor() a: ActorContext, @Param('appointmentId') id: string, @Body(new ZodPipe(RescheduleRequest)) body: RescheduleRequest) {
    return this.c.appointments.reschedule(a, id, body);
  }

  @Post(':appointmentId/:action')
  @HttpCode(200)
  transition(
    @Actor() a: ActorContext,
    @Param('appointmentId') id: string,
    @Param('action', new ZodPipe(TransitionAction)) action: z.infer<typeof TransitionAction>,
    @Body(new ZodPipe(TransitionRequest)) body: TransitionRequest,
  ) {
    return this.c.appointments.transition(a, id, action, body);
  }
}

@Controller('businesses/:businessId/customers')
@UseGuards(BusinessGuard)
export class CustomersController {
  constructor(@Inject(CONTAINER) private readonly c: OrionContainer) {}

  @Get()
  list(@Actor() a: ActorContext, @Query(new ZodPipe(CustomerListQuery)) q: z.infer<typeof CustomerListQuery>) {
    return this.c.customers.list(a, q);
  }

  @Post()
  @HttpCode(201)
  create(@Actor() a: ActorContext, @Body(new ZodPipe(CreateCustomerRequest)) body: z.infer<typeof CreateCustomerRequest>) {
    return this.c.customers.create(a, body);
  }

  @Get(':customerId')
  get(@Actor() a: ActorContext, @Param('customerId') id: string) {
    return this.c.customers.get(a, id);
  }
}

/** ⚠️ Rutas servidas por la SIMULACIÓN del módulo de Sergio. */
@Controller('businesses/:businessId/loyalty')
@UseGuards(BusinessGuard)
export class LoyaltyController {
  constructor(@Inject(CONTAINER) private readonly c: OrionContainer) {}

  @Get('program')
  program(@Actor() a: ActorContext) {
    return this.c.loyalty.getProgram(a);
  }

  @Get('memberships')
  memberships(@Actor() a: ActorContext) {
    return this.c.loyalty.listMemberships(a);
  }

  @Get('memberships/by-customer/:customerId')
  async byCustomer(@Actor() a: ActorContext, @Param('customerId') customerId: string) {
    return { membership: await this.c.loyalty.membershipForCustomer(a, customerId) };
  }

  @Post('redemptions')
  @HttpCode(201)
  redeem(@Actor() a: ActorContext, @Body(new ZodPipe(RedeemRequest)) body: RedeemRequest) {
    return this.c.loyalty.redeem(a, body);
  }
}

@Controller('businesses/:businessId/campaigns')
@UseGuards(BusinessGuard)
export class CampaignsController {
  constructor(@Inject(CONTAINER) private readonly c: OrionContainer) {}

  @Get()
  list(@Actor() a: ActorContext) {
    return this.c.campaigns.list(a);
  }

  @Get('templates')
  templates(@Actor() a: ActorContext) {
    return this.c.campaigns.templates(a);
  }

  @Post('audience-preview')
  @HttpCode(200)
  preview(@Actor() a: ActorContext, @Body(new ZodPipe(AudienceDefinition)) body: AudienceDefinition) {
    return this.c.campaigns.previewAudience(a, body);
  }

  @Post()
  @HttpCode(201)
  create(@Actor() a: ActorContext, @Body(new ZodPipe(SaveCampaignRequest)) body: z.infer<typeof SaveCampaignRequest>) {
    return this.c.campaigns.save(a, null, body);
  }

  @Get(':campaignId')
  get(@Actor() a: ActorContext, @Param('campaignId') id: string) {
    return this.c.campaigns.get(a, id);
  }

  @Patch(':campaignId')
  update(@Actor() a: ActorContext, @Param('campaignId') id: string, @Body(new ZodPipe(SaveCampaignRequest)) body: z.infer<typeof SaveCampaignRequest>) {
    return this.c.campaigns.save(a, id, body);
  }

  @Post(':campaignId/confirm')
  @HttpCode(200)
  confirm(@Actor() a: ActorContext, @Param('campaignId') id: string, @Body(new ZodPipe(ConfirmCampaignRequest)) body: { requestId: string }) {
    return this.c.campaigns.confirm(a, id, body.requestId);
  }
}

@Controller('simulation')
export class SimulationController {
  constructor(@Inject(CONTAINER) private readonly c: OrionContainer) {}

  /** Indica a la app que los datos vienen de adaptadores en memoria. */
  @Get('status')
  async status() {
    const outbox = await this.c.repos.outbox.all();
    return {
      dataSource: 'SIMULATION' as const,
      now: this.c.clock.now().toISOString(),
      outbox: {
        pending: outbox.filter((e) => e.status === 'PENDING').length,
        dispatched: outbox.filter((e) => e.status === 'DISPATCHED').length,
      },
      notice: 'Datos sintéticos en memoria. Se reinician con cada arranque. Sin garantías de persistencia (D09).',
    };
  }
}
