import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from '@orion/contracts';
import { z, type ZodType } from 'zod';

/**
 * Genera docs/openapi.json a partir de los mismos esquemas zod que validan el
 * servidor y la app: un solo origen para el contrato (P06).
 */
type Route = {
  method: 'get' | 'post' | 'patch';
  path: string;
  summary: string;
  query?: ZodType;
  body?: ZodType;
  response?: ZodType;
  status?: number;
  auth?: boolean;
};

const B = '/v1/businesses/{businessId}';
const routes: Route[] = [
  { method: 'get', path: '/v1/auth/dev-users', summary: 'Usuarios sintéticos (login simulado)', response: z.array(C.DevUser), auth: false },
  { method: 'post', path: '/v1/auth/dev-login', summary: 'Login simulado', body: C.DevLoginRequest, response: C.SessionResponse, auth: false, status: 200 },
  { method: 'post', path: '/v1/auth/logout', summary: 'Cerrar sesión', status: 204 },
  { method: 'get', path: '/v1/me', summary: 'Usuario y membresías', response: C.MeResponse },
  { method: 'get', path: '/v1/me/businesses', summary: 'Negocios autorizados', response: z.array(C.MembershipSummary) },
  { method: 'get', path: '/v1/operations/{requestId}', summary: 'Resultado de una operación idempotente', response: C.OperationResult },
  { method: 'get', path: B, summary: 'Perfil, política y checklist del negocio', response: C.BusinessProfile },
  { method: 'patch', path: `${B}/profile`, summary: 'Editar perfil (zona horaria y moneda no editables)', body: C.UpdateProfileRequest, response: C.BusinessProfile },
  { method: 'post', path: `${B}/policy`, summary: 'Reglas de reserva versionadas (dryRun muestra cambios y avisos)', body: C.UpdatePolicyRequest, response: C.PolicyChangeResult, status: 200 },
  { method: 'get', path: `${B}/policy/history`, summary: 'Historial de versiones de reglas', response: z.array(C.PolicyHistoryItem) },
  { method: 'get', path: `${B}/home`, summary: 'Resumen de Inicio', response: C.HomeSummary },
  { method: 'get', path: `${B}/services`, summary: 'Servicios', response: z.array(C.Service) },
  { method: 'get', path: `${B}/professionals`, summary: 'Equipo', response: z.array(C.Professional) },
  { method: 'get', path: `${B}/schedules`, summary: 'Horarios', response: C.SchedulesResponse },
  { method: 'get', path: `${B}/integrations`, summary: 'Estado de integraciones (sin credenciales)', response: z.array(C.Integration) },
  { method: 'get', path: `${B}/availability`, summary: 'Disponibilidad (no es reserva)', query: C.AvailabilityQuery, response: C.AvailabilityResponse },
  { method: 'get', path: `${B}/appointments`, summary: 'Agenda por rango', query: C.AgendaQuery, response: C.AgendaResponse },
  { method: 'post', path: `${B}/appointments`, summary: 'Crear cita (idempotente)', body: C.CreateAppointmentRequest, response: C.Appointment, status: 201 },
  { method: 'get', path: `${B}/appointments/{appointmentId}`, summary: 'Detalle con historial', response: C.AppointmentDetail },
  { method: 'post', path: `${B}/appointments/{appointmentId}/reschedule`, summary: 'Reprogramar (atómico)', body: C.RescheduleRequest, response: C.Appointment, status: 200 },
  ...(['approve', 'reject', 'cancel', 'complete', 'no-show'] as const).map(
    (a): Route => ({ method: 'post', path: `${B}/appointments/{appointmentId}/${a}`, summary: `Transición: ${a}`, body: C.TransitionRequest, response: C.Appointment, status: 200 }),
  ),
  { method: 'get', path: `${B}/customers`, summary: 'Clientes (paginado)', query: C.CustomerListQuery, response: C.CustomerListResponse },
  { method: 'post', path: `${B}/customers`, summary: 'Crear cliente', body: C.CreateCustomerRequest, response: C.CustomerDetail, status: 201 },
  { method: 'get', path: `${B}/customers/{customerId}`, summary: 'Ficha del cliente', response: C.CustomerDetail },
  { method: 'post', path: `${B}/customers/{customerId}/consent`, summary: 'Registrar consentimiento promocional o baja (con constancia)', body: C.UpdateConsentRequest, response: C.CustomerDetail, status: 200 },
  { method: 'get', path: `${B}/customers/{customerId}/export`, summary: 'Exportar datos del cliente (solicitud de acceso)', response: C.CustomerDataExport },
  { method: 'post', path: `${B}/customers/{customerId}/anonymize`, summary: 'Eliminar datos personales (conserva citas sin identificar)', body: C.AnonymizeCustomerRequest, response: C.CustomerDetail, status: 200 },
  { method: 'get', path: `${B}/privacy`, summary: 'Privacidad: consentimientos, solicitudes y políticas pendientes', response: C.PrivacyOverview },
  { method: 'post', path: `${B}/privacy/requests`, summary: 'Registrar solicitud de derechos (acceso, rectificación, cancelación, oposición)', body: C.CreatePrivacyRequest, response: C.PrivacyRequest, status: 201 },
  { method: 'get', path: `${B}/privacy/requests/{requestId}`, summary: 'Detalle de solicitud', response: C.PrivacyRequest },
  ...(['start', 'complete', 'reject'] as const).map(
    (a): Route => ({ method: 'post', path: `${B}/privacy/requests/{requestId}/${a}`, summary: `Solicitud: ${a}`, body: C.PrivacyRequestTransition, response: C.PrivacyRequest, status: 200 }),
  ),
  { method: 'post', path: `${B}/services`, summary: 'Crear servicio', body: C.SaveServiceRequest, response: C.Service, status: 201 },
  { method: 'patch', path: `${B}/services/{serviceId}`, summary: 'Editar/archivar servicio (no altera citas existentes)', body: C.SaveServiceRequest, response: C.Service },
  { method: 'post', path: `${B}/professionals`, summary: 'Alta de profesional (sin usuario)', body: C.SaveProfessionalRequest, response: C.Professional, status: 201 },
  { method: 'patch', path: `${B}/professionals/{professionalId}`, summary: 'Editar profesional', body: C.SaveProfessionalRequest, response: C.Professional },
  { method: 'get', path: `${B}/professionals/{professionalId}/future-appointments`, summary: 'Citas futuras a resolver antes de una baja', response: z.array(C.ScheduleConflict) },
  { method: 'post', path: `${B}/professionals/{professionalId}/status`, summary: 'Activar/desactivar (rechaza si hay citas futuras)', body: C.ProfessionalStatusRequest, response: C.Professional, status: 200 },
  { method: 'post', path: `${B}/schedules/weekly`, summary: 'Jornada semanal (dryRun devuelve conflictos)', body: C.WeeklyHoursRequest, response: C.ScheduleChangeResult, status: 200 },
  { method: 'post', path: `${B}/schedules/exceptions`, summary: 'Excepción por fecha (cierre u horario especial)', body: C.ExceptionRequest, response: C.ScheduleChangeResult, status: 200 },
  { method: 'post', path: `${B}/schedules/exceptions/{exceptionId}/delete`, summary: 'Quitar excepción', body: C.SimpleCommand, status: 204 },
  { method: 'get', path: `${B}/blocks`, summary: 'Bloqueos en un rango', query: z.object({ from: C.IsoDateTime, to: C.IsoDateTime }), response: z.array(C.Block) },
  { method: 'post', path: `${B}/blocks`, summary: 'Crear bloqueo (misma exclusión que las citas)', body: C.CreateBlockRequest, response: C.Block, status: 201 },
  { method: 'post', path: `${B}/blocks/{blockId}/remove`, summary: 'Quitar bloqueo', body: C.SimpleCommand, status: 204 },
  { method: 'get', path: `${B}/notifications`, summary: 'Bandeja de avisos', response: C.NotificationsResponse },
  { method: 'post', path: `${B}/notifications/read`, summary: 'Marcar avisos como leídos', body: C.MarkNotificationsRequest, response: C.NotificationsResponse, status: 200 },
  ...(['pause', 'resume', 'cancel'] as const).map(
    (a): Route => ({ method: 'post', path: `${B}/campaigns/{campaignId}/${a}`, summary: `Campaña: ${a}`, body: C.SimpleCommand, response: C.Campaign, status: 200 }),
  ),
  { method: 'get', path: `${B}/loyalty/program`, summary: '[Sergio · simulado] Programa', response: C.LoyaltyProgram },
  { method: 'get', path: `${B}/loyalty/memberships`, summary: '[Sergio · simulado] Membresías', response: z.array(C.LoyaltyMembership) },
  { method: 'get', path: `${B}/loyalty/memberships/by-customer/{customerId}`, summary: '[Sergio · simulado] Membresía de un cliente', response: z.object({ membership: C.LoyaltyMembership.nullable() }) },
  { method: 'post', path: `${B}/loyalty/redemptions`, summary: '[Sergio · simulado] Canje', body: C.RedeemRequest, response: C.RedemptionResult, status: 201 },
  { method: 'get', path: `${B}/campaigns`, summary: 'Campañas', response: z.array(C.Campaign) },
  { method: 'get', path: `${B}/campaigns/templates`, summary: 'Plantillas', response: z.array(C.MessageTemplate) },
  { method: 'post', path: `${B}/campaigns/audience-preview`, summary: 'Vista previa de audiencia', body: C.AudienceDefinition, response: C.AudiencePreview, status: 200 },
  { method: 'post', path: `${B}/campaigns`, summary: 'Crear borrador', body: C.SaveCampaignRequest, response: C.Campaign, status: 201 },
  { method: 'get', path: `${B}/campaigns/{campaignId}`, summary: 'Detalle de campaña', response: C.Campaign },
  { method: 'patch', path: `${B}/campaigns/{campaignId}`, summary: 'Editar borrador', body: C.SaveCampaignRequest, response: C.Campaign },
  { method: 'post', path: `${B}/campaigns/{campaignId}/confirm`, summary: 'Programar envío', body: C.ConfirmCampaignRequest, response: C.Campaign, status: 200 },
];

const schema = (t: ZodType, io: 'input' | 'output') => z.toJSONSchema(t, { io, unrepresentable: 'any' });

function build() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of routes) {
    const params = [...r.path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }));
    const query = r.query
      ? Object.entries((schema(r.query, 'input') as { properties?: Record<string, unknown>; required?: string[] }).properties ?? {}).map(([name, s]) => ({
          name,
          in: 'query',
          required: ((schema(r.query!, 'input') as { required?: string[] }).required ?? []).includes(name),
          schema: s,
        }))
      : [];
    const status = String(r.status ?? 200);
    paths[r.path] ??= {};
    paths[r.path]![r.method] = {
      summary: r.summary,
      ...(r.auth === false ? { security: [] } : {}),
      parameters: [...params, ...query],
      ...(r.body ? { requestBody: { required: true, content: { 'application/json': { schema: schema(r.body, 'input') } } } } : {}),
      responses: {
        [status]: r.response ? { description: 'OK', content: { 'application/json': { schema: schema(r.response, 'output') } } } : { description: 'Sin contenido' },
        default: { description: 'Error', content: { 'application/json': { schema: schema(C.ErrorEnvelope, 'output') } } },
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Orion Business API',
      version: '0.1.0',
      description: 'Contrato v1. Servido hoy por adaptadores en memoria (SIMULACIÓN); persistencia pendiente de D09.',
    },
    servers: [{ url: 'http://localhost:3000' }],
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
    security: [{ bearer: [] }],
    paths,
  };
}

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../../../docs/openapi.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(build(), null, 2)}\n`);
console.log(`OpenAPI escrito en ${out} (${routes.length} operaciones)`);
