import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  AgendaQuery,
  AppointmentStatus,
  AudienceDefinition,
  AvailabilityQuery,
  ConfirmCampaignRequest,
  CreateAppointmentRequest,
  CreateBlockRequest,
  CreateCustomerRequest,
  ExceptionRequest,
  MarkNotificationsRequest,
  ProfessionalStatusRequest,
  SaveProfessionalRequest,
  SaveServiceRequest,
  SimpleCommand,
  UpdatePolicyRequest,
  UpdateProfileRequest,
  WeeklyHoursRequest,
  CustomerListQuery,
  DevLoginRequest,
  RedeemRequest,
  RescheduleRequest,
  SaveCampaignRequest,
  TransitionRequest,
  AnonymizeCustomerRequest,
  CreateCustomerNoteRequest,
  MergeCustomersRequest,
  UpdateCustomerRequest,
  CreatePrivacyRequest,
  PrivacyRequestAction,
  PrivacyRequestTransition,
  UpdateConsentRequest,
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

  // ── Perfil y reglas de reserva (UI15) ──

  @Patch('profile')
  updateProfile(@Actor() a: ActorContext, @Body(new ZodPipe(UpdateProfileRequest)) body: z.infer<typeof UpdateProfileRequest>) {
    return this.c.settings.updateProfile(a, body);
  }

  @Post('policy')
  @HttpCode(200)
  updatePolicy(@Actor() a: ActorContext, @Body(new ZodPipe(UpdatePolicyRequest)) body: z.infer<typeof UpdatePolicyRequest>) {
    return this.c.settings.updatePolicy(a, body);
  }

  @Get('policy/history')
  policyHistory(@Actor() a: ActorContext) {
    return this.c.settings.policyHistory(a);
  }

  // ── Configuración (P17–P19) ──

  @Post('services')
  @HttpCode(201)
  createService(@Actor() a: ActorContext, @Body(new ZodPipe(SaveServiceRequest)) body: z.infer<typeof SaveServiceRequest>) {
    return this.c.config.saveService(a, null, body);
  }

  @Patch('services/:serviceId')
  updateService(@Actor() a: ActorContext, @Param('serviceId') id: string, @Body(new ZodPipe(SaveServiceRequest)) body: z.infer<typeof SaveServiceRequest>) {
    return this.c.config.saveService(a, id, body);
  }

  @Post('professionals')
  @HttpCode(201)
  createProfessional(@Actor() a: ActorContext, @Body(new ZodPipe(SaveProfessionalRequest)) body: z.infer<typeof SaveProfessionalRequest>) {
    return this.c.config.saveProfessional(a, null, body);
  }

  @Patch('professionals/:professionalId')
  updateProfessional(@Actor() a: ActorContext, @Param('professionalId') id: string, @Body(new ZodPipe(SaveProfessionalRequest)) body: z.infer<typeof SaveProfessionalRequest>) {
    return this.c.config.saveProfessional(a, id, body);
  }

  @Get('professionals/:professionalId/future-appointments')
  futureAppointments(@Actor() a: ActorContext, @Param('professionalId') id: string) {
    return this.c.config.futureAppointments(a, id);
  }

  @Post('professionals/:professionalId/status')
  @HttpCode(200)
  professionalStatus(@Actor() a: ActorContext, @Param('professionalId') id: string, @Body(new ZodPipe(ProfessionalStatusRequest)) body: z.infer<typeof ProfessionalStatusRequest>) {
    return this.c.config.setProfessionalActive(a, id, body.active, body.requestId);
  }

  @Post('schedules/weekly')
  @HttpCode(200)
  weekly(@Actor() a: ActorContext, @Body(new ZodPipe(WeeklyHoursRequest)) body: z.infer<typeof WeeklyHoursRequest>) {
    return this.c.config.setWeeklyHours(a, body);
  }

  @Post('schedules/exceptions')
  @HttpCode(200)
  exception(@Actor() a: ActorContext, @Body(new ZodPipe(ExceptionRequest)) body: z.infer<typeof ExceptionRequest>) {
    return this.c.config.saveException(a, body);
  }

  @Post('schedules/exceptions/:exceptionId/delete')
  @HttpCode(204)
  deleteException(@Actor() a: ActorContext, @Param('exceptionId') id: string, @Body(new ZodPipe(SimpleCommand)) body: { requestId: string }) {
    return this.c.config.deleteException(a, id, body.requestId);
  }

  @Get('blocks')
  blocks(@Actor() a: ActorContext, @Query(new ZodPipe(z.object({ from: z.iso.datetime({ offset: true }), to: z.iso.datetime({ offset: true }) }))) q: { from: string; to: string }) {
    return this.c.config.blocks(a, new Date(q.from), new Date(q.to));
  }

  @Post('blocks')
  @HttpCode(201)
  createBlock(@Actor() a: ActorContext, @Body(new ZodPipe(CreateBlockRequest)) body: z.infer<typeof CreateBlockRequest>) {
    return this.c.config.createBlock(a, body);
  }

  @Post('blocks/:blockId/remove')
  @HttpCode(204)
  removeBlock(@Actor() a: ActorContext, @Param('blockId') id: string, @Body(new ZodPipe(SimpleCommand)) body: { requestId: string }) {
    return this.c.config.removeBlock(a, id, body.requestId);
  }

  // ── Notificaciones (UI18) ──

  @Get('notifications')
  notifications(@Actor() a: ActorContext) {
    return this.c.notifications.list(a);
  }

  @Post('notifications/read')
  @HttpCode(200)
  markRead(@Actor() a: ActorContext, @Body(new ZodPipe(MarkNotificationsRequest)) body: MarkNotificationsRequest) {
    return this.c.notifications.markRead(a, body);
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

  @Patch(':customerId')
  update(@Actor() a: ActorContext, @Param('customerId') id: string, @Body(new ZodPipe(UpdateCustomerRequest)) body: z.input<typeof UpdateCustomerRequest>) {
    return this.c.customers.update(a, id, body);
  }

  @Post(':customerId/notes')
  @HttpCode(201)
  addNote(@Actor() a: ActorContext, @Param('customerId') id: string, @Body(new ZodPipe(CreateCustomerNoteRequest)) body: z.input<typeof CreateCustomerNoteRequest>) {
    return this.c.customers.addNote(a, id, body);
  }

  @Post(':customerId/notes/:noteId/delete')
  @HttpCode(200)
  deleteNote(@Actor() a: ActorContext, @Param('customerId') id: string, @Param('noteId') noteId: string, @Body(new ZodPipe(SimpleCommand)) body: z.infer<typeof SimpleCommand>) {
    return this.c.customers.deleteNote(a, id, noteId, body.requestId);
  }

  @Get(':customerId/merge-preview')
  mergePreview(@Actor() a: ActorContext, @Param('customerId') id: string, @Query('with') duplicateId: string) {
    return this.c.customerMerge.preview(a, id, duplicateId ?? '');
  }

  @Post(':customerId/merge')
  @HttpCode(200)
  merge(@Actor() a: ActorContext, @Param('customerId') id: string, @Body(new ZodPipe(MergeCustomersRequest)) body: z.input<typeof MergeCustomersRequest>) {
    return this.c.customerMerge.merge(a, id, body);
  }

  // ── Privacidad (sección 14) ──

  @Post(':customerId/consent')
  @HttpCode(200)
  consent(@Actor() a: ActorContext, @Param('customerId') id: string, @Body(new ZodPipe(UpdateConsentRequest)) body: z.input<typeof UpdateConsentRequest>) {
    return this.c.privacy.updateConsent(a, id, body);
  }

  @Get(':customerId/export')
  exportData(@Actor() a: ActorContext, @Param('customerId') id: string) {
    return this.c.privacy.exportCustomer(a, id);
  }

  @Post(':customerId/anonymize')
  @HttpCode(200)
  anonymize(@Actor() a: ActorContext, @Param('customerId') id: string, @Body(new ZodPipe(AnonymizeCustomerRequest)) body: z.input<typeof AnonymizeCustomerRequest>) {
    return this.c.privacy.anonymize(a, id, body);
  }
}

@Controller('businesses/:businessId/privacy')
@UseGuards(BusinessGuard)
export class PrivacyController {
  constructor(@Inject(CONTAINER) private readonly c: OrionContainer) {}

  @Get()
  overview(@Actor() a: ActorContext) {
    return this.c.privacy.overview(a);
  }

  @Post('requests')
  @HttpCode(201)
  create(@Actor() a: ActorContext, @Body(new ZodPipe(CreatePrivacyRequest)) body: z.input<typeof CreatePrivacyRequest>) {
    return this.c.privacy.createRequest(a, body);
  }

  @Get('requests/:requestId')
  get(@Actor() a: ActorContext, @Param('requestId') id: string) {
    return this.c.privacy.getRequest(a, id);
  }

  @Post('requests/:requestId/:action')
  @HttpCode(200)
  transition(
    @Actor() a: ActorContext,
    @Param('requestId') id: string,
    @Param('action', new ZodPipe(PrivacyRequestAction)) action: z.infer<typeof PrivacyRequestAction>,
    @Body(new ZodPipe(PrivacyRequestTransition)) body: z.input<typeof PrivacyRequestTransition>,
  ) {
    return this.c.privacy.transition(a, id, action, body);
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
  @Post(':campaignId/:action')
  @HttpCode(200)
  changeStatus(
    @Actor() a: ActorContext,
    @Param('campaignId') id: string,
    @Param('action', new ZodPipe(z.enum(['pause', 'resume', 'cancel']))) action: 'pause' | 'resume' | 'cancel',
    @Body(new ZodPipe(SimpleCommand)) body: { requestId: string },
  ) {
    return this.c.campaigns.changeStatus(a, id, action, body.requestId);
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
