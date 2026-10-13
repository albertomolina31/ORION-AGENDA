import type { BookingPolicy } from '@orion/contracts';
import { DateTime } from 'luxon';
import { requiredInterval } from '../domain/availability.js';
import { MINUTE } from '../domain/interval.js';
import type {
  Appointment,
  Business,
  Customer,
  Professional,
  ProfessionalService,
  Service,
  WeeklyHours,
} from '../domain/model.js';
import { emptyState, type MemoryState } from '../infrastructure/memory/memory-database.js';
import type { LoyaltySimState } from '../application/loyalty-simulation.js';
import type { CampaignState } from '../application/campaign-service.js';

/**
 * ⚠️ DATOS SINTÉTICOS. Ningún dato corresponde a personas reales.
 * Se generan relativos al "hoy" del negocio para que la demo siempre tenga agenda.
 */

export const ORBITA = 'biz_orbita';
export const LUNA = 'biz_luna';
export const ZONE = 'America/Mazatlan';

export const defaultPolicy: BookingPolicy = {
  version: 1,
  confirmationMode: 'MANUAL',
  slotGranularityMin: 15,
  minLeadMin: 60,
  maxHorizonDays: 60,
  approvalWindowMin: 30,
  customerCancelUntilMin: 120,
  customerRescheduleUntilMin: 120,
  noShowGraceMin: 15,
};

/** PRNG determinista (mulberry32) para que los fixtures sean reproducibles. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Alejandra', 'Bruno', 'Camila', 'Daniela', 'Emilio', 'Fernanda', 'Gabriel', 'Héctor', 'Isabel', 'Jimena', 'Karla', 'Leonardo', 'Mónica', 'Natalia', 'Óscar', 'Patricia', 'Ricardo', 'Sandra', 'Tomás', 'Ximena', 'Yolanda', 'Rodrigo', 'Renata', 'Mauricio', 'Adriana', 'Julio', 'Elena', 'Marco', 'Regina', 'Iván'];
const LAST = ['García', 'Hernández', 'Martínez', 'González', 'Ramírez', 'Flores', 'Cruz', 'Morales', 'Ortiz', 'Castillo', 'Navarro', 'Romero', 'Silva', 'Vargas', 'Reyes', 'Medina', 'Aguilar', 'Domínguez', 'Guerrero', 'Ibarra'];

export interface SeedResult {
  db: MemoryState;
  loyalty: LoyaltySimState;
  campaigns: CampaignState;
}

export function buildSeed(now: Date): SeedResult {
  const s = emptyState();
  const today = DateTime.fromJSDate(now, { zone: ZONE }).startOf('day');
  const at = (dayOffset: number, hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return today.plus({ days: dayOffset }).set({ hour: h, minute: m }).toJSDate();
  };

  // ── Usuarios y membresías ──
  s.users.push(
    { id: 'u_alberto', email: 'alberto@orbita.test', name: 'Alberto', active: true },
    { id: 'u_carmen', email: 'carmen@orbita.test', name: 'Carmen', active: true },
    { id: 'u_rocio', email: 'rocio@orbita.test', name: 'Rocío', active: true },
    { id: 'u_ana', email: 'ana@orbita.test', name: 'Ana', active: true },
  );
  s.memberships.push(
    { userId: 'u_alberto', businessId: ORBITA, role: 'OWNER', grants: [], revokes: [], professionalId: null, active: true },
    { userId: 'u_alberto', businessId: LUNA, role: 'OWNER', grants: [], revokes: [], professionalId: null, active: true },
    { userId: 'u_carmen', businessId: ORBITA, role: 'ADMIN', grants: [], revokes: [], professionalId: null, active: true },
    { userId: 'u_rocio', businessId: ORBITA, role: 'RECEPTION', grants: [], revokes: [], professionalId: null, active: true },
    { userId: 'u_ana', businessId: ORBITA, role: 'PROFESSIONAL', grants: [], revokes: [], professionalId: 'pro_ana', active: true },
  );

  // ── Negocios ──
  const orbita: Business = {
    id: ORBITA,
    name: 'Estudio Órbita',
    category: 'HAIR_BEAUTY',
    timezone: ZONE,
    currency: 'MXN',
    status: 'ACTIVE',
    acceptingExternalBookings: true,
    widgetPrivacy: 'INITIALS',
    policy: defaultPolicy,
    policyHistory: [{ policy: defaultPolicy, changedAt: today.minus({ days: 200 }).toJSDate(), changedBy: 'Alberto' }],
    integrations: { whatsapp: 'CONNECTED', appleWallet: 'NOT_CONNECTED', googleWallet: 'NOT_CONNECTED' },
    features: { loyalty: true, campaigns: true },
  };
  const luna: Business = {
    id: LUNA,
    name: 'Consultorio Luna',
    category: 'CLINIC',
    timezone: ZONE,
    currency: 'MXN',
    status: 'ACTIVE',
    acceptingExternalBookings: false,
    widgetPrivacy: 'INITIALS',
    policy: { ...defaultPolicy, confirmationMode: 'AUTOMATIC' },
    policyHistory: [{ policy: { ...defaultPolicy, confirmationMode: 'AUTOMATIC' }, changedAt: today.minus({ days: 90 }).toJSDate(), changedBy: 'Alberto' }],
    integrations: { whatsapp: 'NOT_CONNECTED', appleWallet: 'NOT_CONNECTED', googleWallet: 'NOT_CONNECTED' },
    features: { loyalty: false, campaigns: false },
  };
  s.businesses.push(orbita, luna);

  // ── Equipo y servicios ──
  const pros: Professional[] = [
    { id: 'pro_ana', businessId: ORBITA, name: 'Ana', colorKey: 'lavender', userId: 'u_ana', active: true },
    { id: 'pro_luis', businessId: ORBITA, name: 'Luis', colorKey: 'mint', userId: null, active: true },
    { id: 'pro_sofia', businessId: ORBITA, name: 'Sofía', colorKey: 'peach', userId: null, active: true },
    { id: 'pro_elena', businessId: LUNA, name: 'Dra. Elena Ruiz', colorKey: 'sky', userId: null, active: true },
  ];
  s.professionals.push(...pros);
  const svc = (id: string, businessId: string, name: string, durationMin: number, priceMxn: number, bufferAfterMin = 0): Service => ({
    id,
    businessId,
    name,
    durationMin,
    bufferBeforeMin: 0,
    bufferAfterMin,
    priceMinor: priceMxn * 100,
    currency: 'MXN',
    active: true,
  });
  const services: Service[] = [
    svc('svc_corte_peinado', ORBITA, 'Corte y peinado', 45, 450),
    svc('svc_corte_clasico', ORBITA, 'Corte clásico', 30, 280),
    svc('svc_manicura', ORBITA, 'Manicura', 60, 350, 15),
    svc('svc_coloracion', ORBITA, 'Coloración', 120, 1200, 15),
    svc('svc_barba', ORBITA, 'Arreglo de barba', 20, 180),
    svc('svc_consulta', LUNA, 'Consulta general', 30, 600),
  ];
  s.services.push(...services, { ...svc('svc_keratina', ORBITA, 'Keratina (archivado)', 90, 1500), active: false });
  const link = (businessId: string, professionalId: string, serviceId: string): ProfessionalService => ({ businessId, professionalId, serviceId });
  s.professionalServices.push(
    link(ORBITA, 'pro_ana', 'svc_corte_peinado'),
    link(ORBITA, 'pro_ana', 'svc_coloracion'),
    link(ORBITA, 'pro_ana', 'svc_corte_clasico'),
    link(ORBITA, 'pro_luis', 'svc_corte_clasico'),
    link(ORBITA, 'pro_luis', 'svc_barba'),
    link(ORBITA, 'pro_luis', 'svc_corte_peinado'),
    link(ORBITA, 'pro_sofia', 'svc_manicura'),
    link(ORBITA, 'pro_sofia', 'svc_coloracion'),
    link(LUNA, 'pro_elena', 'svc_consulta'),
  );

  // ── Horarios (jornada partida con descanso) ──
  const week = (ranges: Array<{ start: string; end: string }>, days = [1, 2, 3, 4, 5, 6]) =>
    Object.fromEntries(days.map((d) => [d, ranges]));
  const hours: WeeklyHours[] = [
    { businessId: ORBITA, professionalId: null, days: week([{ start: '09:00', end: '20:00' }]) },
    { businessId: ORBITA, professionalId: 'pro_ana', days: week([{ start: '09:00', end: '14:00' }, { start: '15:00', end: '19:00' }]) },
    { businessId: ORBITA, professionalId: 'pro_luis', days: week([{ start: '09:00', end: '13:30' }, { start: '14:30', end: '19:00' }]) },
    { businessId: ORBITA, professionalId: 'pro_sofia', days: week([{ start: '11:00', end: '15:00' }, { start: '16:00', end: '20:00' }], [2, 3, 4, 5, 6, 1]) },
    { businessId: LUNA, professionalId: null, days: week([{ start: '08:00', end: '16:00' }], [1, 2, 3, 4, 5]) },
    { businessId: LUNA, professionalId: 'pro_elena', days: week([{ start: '08:00', end: '12:00' }, { start: '13:00', end: '16:00' }], [1, 2, 3, 4, 5]) },
  ];
  s.weeklyHours.push(...hours);
  // Domingo cerrado; excepción de ejemplo: cierre del negocio dentro de 10 días.
  s.exceptions.push({ id: 'exc_seed_1', businessId: ORBITA, professionalId: null, date: today.plus({ days: 10 }).toISODate()!, closed: true, intervals: [], reason: 'Capacitación del equipo' });

  // ── Clientes ──
  const random = rng(42);
  let custSeq = 0;
  const customer = (businessId: string, name: string, opts: Partial<Customer> = {}): Customer => {
    custSeq += 1;
    const c: Customer = {
      id: `cus_${String(custSeq).padStart(3, '0')}`,
      businessId,
      name,
      phoneE164: `+52669${String(1000000 + Math.floor(random() * 8999999)).slice(0, 7)}`,
      email: null,
      note: null,
      preferredProfessionalId: null,
      promotionalConsent: random() < 0.72 ? 'GRANTED' : random() < 0.75 ? 'NOT_GRANTED' : 'REVOKED',
      createdAt: today.minus({ days: 200 + Math.floor(random() * 300) }).toJSDate(),
      ...opts,
    };
    s.customers.push(c);
    return c;
  };
  const named = {
    mariana: customer(ORBITA, 'Mariana López', {
      preferredProfessionalId: 'pro_ana',
      note: 'Prefiere citas por la mañana',
      promotionalConsent: 'GRANTED',
      createdAt: today.minus({ days: 210 }).toJSDate(),
    }),
    diego: customer(ORBITA, 'Diego Torres', { preferredProfessionalId: 'pro_luis' }),
    carlos: customer(ORBITA, 'Carlos Ruiz', { preferredProfessionalId: 'pro_luis' }),
    valeria: customer(ORBITA, 'Valeria Soto', { preferredProfessionalId: 'pro_sofia' }),
    lucia: customer(ORBITA, 'Lucía Méndez', { createdAt: today.minus({ days: 3 }).toJSDate() }),
    andres: customer(ORBITA, 'Andrés Vega', { createdAt: today.minus({ days: 2 }).toJSDate() }),
    paula: customer(ORBITA, 'Paula Ríos', { createdAt: today.minus({ days: 1 }).toJSDate() }),
    sofiaP: customer(ORBITA, 'Sofía Pérez'),
    fernanda: customer(ORBITA, 'Fernanda Gil'),
    jorge: customer(ORBITA, 'Jorge Salas'),
  };
  const generated: Customer[] = [];
  while (s.customers.filter((c) => c.businessId === ORBITA).length < 128) {
    const name = `${FIRST[Math.floor(random() * FIRST.length)]} ${LAST[Math.floor(random() * LAST.length)]}`;
    if (s.customers.some((c) => c.name === name)) continue;
    generated.push(customer(ORBITA, name));
  }
  customer(LUNA, 'Mariana López', { note: null, promotionalConsent: 'NOT_GRANTED' });
  customer(LUNA, 'Roberto Chávez', { promotionalConsent: 'NOT_GRANTED' });
  // Duplicado de ejemplo: llegó por WhatsApp con el mismo teléfono que Diego (no se une solo).
  const diegoDup = customer(ORBITA, 'Diego Torres', {
    phoneE164: named.diego.phoneE164,
    email: 'diego.torres@correo.test',
    promotionalConsent: 'NOT_GRANTED',
    createdAt: today.minus({ days: 20 }).toJSDate(),
  });

  // ── Citas ──
  let aptSeq = 0;
  const serviceById = new Map([...s.services].map((x) => [x.id, x]));
  const book = (
    c: Customer,
    proId: string,
    serviceId: string,
    startsAt: Date,
    status: Appointment['status'],
    source: Appointment['source'] = 'STAFF_APP',
    expiresAt: Date | null = null,
  ): Appointment => {
    aptSeq += 1;
    const sv = serviceById.get(serviceId)!;
    const a: Appointment = {
      id: `apt_seed_${String(aptSeq).padStart(4, '0')}`,
      businessId: c.businessId,
      customerId: c.id,
      professionalId: proId,
      serviceId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + sv.durationMin * MINUTE),
      status,
      source,
      expiresAt,
      version: 1,
      snapshot: {
        serviceName: sv.name,
        durationMin: sv.durationMin,
        bufferBeforeMin: sv.bufferBeforeMin,
        bufferAfterMin: sv.bufferAfterMin,
        priceMinor: sv.priceMinor,
        currency: sv.currency,
        policyVersion: 1,
      },
      customerNotice: source === 'WHATSAPP' ? 'SENT' : 'NOT_APPLICABLE',
      createdAt: new Date(startsAt.getTime() - 3 * 86_400_000),
      createdBy: source === 'WHATSAPP' ? 'channel:whatsapp' : 'u_alberto',
    };
    s.appointments.push(a);
    s.history.push({
      appointmentId: a.id,
      businessId: a.businessId,
      at: a.createdAt,
      fromStatus: null,
      toStatus: status === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : 'CONFIRMED',
      action: source === 'WHATSAPP' ? 'request' : 'create',
      actorId: a.createdBy,
      actorName: source === 'WHATSAPP' ? 'WhatsApp' : 'Alberto',
      reason: null,
      previousStartsAt: null,
    });
    if (status !== 'CONFIRMED' && status !== 'PENDING_APPROVAL') {
      s.history.push({
        appointmentId: a.id,
        businessId: a.businessId,
        at: a.endsAt,
        fromStatus: 'CONFIRMED',
        toStatus: status,
        action: status === 'COMPLETED' ? 'complete' : status.toLowerCase(),
        actorId: proId,
        actorName: 'Alberto',
        reason: null,
        previousStartsAt: null,
      });
    }
    const occ = requiredInterval(startsAt.getTime(), sv);
    s.occupancies.push({
      id: `occ_${a.id}`,
      businessId: a.businessId,
      professionalId: proId,
      start: new Date(occ.start),
      end: new Date(occ.end),
      kind: 'APPOINTMENT',
      appointmentId: a.id,
      active: status === 'CONFIRMED' || status === 'PENDING_APPROVAL',
      label: null,
    });
    return a;
  };

  // Historial de Mariana: 6 visitas completadas, última hace 21 días.
  [21, 42, 63, 91, 120, 150].forEach((d) => book(named.mariana, 'pro_ana', 'svc_corte_peinado', at(-d, '10:00'), 'COMPLETED'));
  book(named.diego, 'pro_luis', 'svc_corte_clasico', at(-7, '12:00'), 'COMPLETED');
  book(named.carlos, 'pro_luis', 'svc_corte_clasico', at(-15, '11:00'), 'COMPLETED');
  book(named.valeria, 'pro_sofia', 'svc_manicura', at(-14, '12:00'), 'COMPLETED');
  book(named.sofiaP, 'pro_sofia', 'svc_manicura', at(-29, '17:00'), 'COMPLETED');
  book(named.jorge, 'pro_luis', 'svc_barba', at(-40, '10:00'), 'COMPLETED');

  // Visitas pasadas para clientes generados (algunos inactivos > 60 días).
  const proForService: Record<string, string[]> = {
    svc_corte_peinado: ['pro_ana', 'pro_luis'],
    svc_corte_clasico: ['pro_luis', 'pro_ana'],
    svc_manicura: ['pro_sofia'],
    svc_barba: ['pro_luis'],
  };
  const svcIds = Object.keys(proForService);
  generated.forEach((c, i) => {
    const visits = Math.floor(random() * 6);
    const inactive = i % 3 === 0;
    for (let v = 0; v < visits; v++) {
      const daysAgo = (inactive ? 65 : 3) + Math.floor(random() * 160);
      const serviceId = svcIds[Math.floor(random() * svcIds.length)]!;
      const pro = proForService[serviceId]![Math.floor(random() * proForService[serviceId]!.length)]!;
      const hour = 9 + Math.floor(random() * 4);
      const status = random() < 0.92 ? 'COMPLETED' : random() < 0.5 ? 'NO_SHOW' : 'CANCELLED';
      book(c, pro, serviceId, at(-daysAgo, `${String(hour).padStart(2, '0')}:${random() < 0.5 ? '00' : '30'}`), status);
    }
  });

  // Hoy (como en los mockups).
  book(named.mariana, 'pro_ana', 'svc_corte_peinado', at(0, '10:00'), 'CONFIRMED');
  book(named.diego, 'pro_luis', 'svc_corte_clasico', at(0, '10:30'), 'CONFIRMED');
  book(named.carlos, 'pro_luis', 'svc_corte_clasico', at(0, '11:00'), 'CONFIRMED');
  book(named.valeria, 'pro_sofia', 'svc_manicura', at(0, '12:00'), 'CONFIRMED');
  book(named.lucia, 'pro_sofia', 'svc_manicura', at(0, '13:30'), 'CONFIRMED', 'WHATSAPP');
  book(generated[4]!, 'pro_ana', 'svc_corte_clasico', at(0, '16:00'), 'CONFIRMED');
  // Solicitudes por WhatsApp pendientes de aprobación con vencimiento explícito.
  book(named.fernanda, 'pro_ana', 'svc_corte_peinado', at(0, '17:00'), 'PENDING_APPROVAL', 'WHATSAPP', new Date(now.getTime() + 25 * MINUTE));
  book(named.jorge, 'pro_luis', 'svc_barba', at(1, '12:00'), 'PENDING_APPROVAL', 'WHATSAPP', new Date(now.getTime() + 18 * MINUTE));
  // Próximos días.
  book(named.andres, 'pro_luis', 'svc_corte_clasico', at(1, '09:30'), 'CONFIRMED', 'WHATSAPP');
  book(named.paula, 'pro_ana', 'svc_corte_peinado', at(2, '11:00'), 'CONFIRMED');
  book(generated[7]!, 'pro_sofia', 'svc_manicura', at(1, '17:00'), 'CONFIRMED');
  book(generated[9]!, 'pro_ana', 'svc_coloracion', at(3, '15:00'), 'CONFIRMED');

  // Cancelación hecha por el cliente desde WhatsApp (aparece en la bandeja de avisos).
  const cancelledByChannel = book(generated[12]!, 'pro_luis', 'svc_corte_clasico', at(0, '15:00'), 'CANCELLED', 'WHATSAPP');
  cancelledByChannel.version = 2;
  const cancelEntry = s.history.find((h) => h.appointmentId === cancelledByChannel.id && h.toStatus === 'CANCELLED')!;
  Object.assign(cancelEntry, { actorId: 'channel:whatsapp', actorName: 'Cliente (WhatsApp)', at: new Date(now.getTime() - 25 * MINUTE), reason: 'Cancelada por el cliente' });

  // Eventos de dominio de lo que llegó por WhatsApp (base de la bandeja de notificaciones).
  let evtSeq = 0;
  const event = (a: Appointment, eventType: string, occurredAt: Date) => {
    evtSeq += 1;
    s.outbox.push({
      eventId: `evt_seed_${evtSeq}`,
      eventType,
      schemaVersion: 1,
      occurredAt,
      businessId: a.businessId,
      aggregateId: a.id,
      aggregateVersion: a.version,
      correlationId: `seed-${evtSeq}`,
      payload: { appointmentId: a.id, customerId: a.customerId, serviceId: a.serviceId, professionalId: a.professionalId, startsAt: a.startsAt.toISOString(), status: a.status },
      status: 'DISPATCHED',
      attempts: 1,
      actorId: 'channel:whatsapp',
    });
  };
  s.appointments
    .filter((a) => a.source === 'WHATSAPP' && a.startsAt.getTime() >= today.toMillis())
    .forEach((a, i) => {
      const when = new Date(now.getTime() - (40 + i * 35) * MINUTE);
      if (a.status === 'PENDING_APPROVAL') event(a, 'appointment.pending', new Date(now.getTime() - (5 + i * 7) * MINUTE));
      else if (a.status === 'CANCELLED') event(a, 'appointment.cancelled', new Date(now.getTime() - 25 * MINUTE));
      else event(a, 'appointment.confirmed', when);
    });

  // Consultorio Luna (aislamiento entre negocios).
  const lunaPatient = s.customers.find((c) => c.businessId === LUNA)!;
  book(lunaPatient, 'pro_elena', 'svc_consulta', at(0, '09:00'), 'CONFIRMED');

  // ── Fidelidad (simulación del módulo de Sergio) ──
  const loyalty: LoyaltySimState = {
    programs: [
      {
        id: 'lp_orbita',
        businessId: ORBITA,
        version: 1,
        status: 'ACTIVE',
        name: 'Tarjeta de fidelidad',
        stampsRequired: 7,
        eligibleServiceIds: ['svc_corte_clasico', 'svc_corte_peinado'],
        reward: { type: 'PERCENT_DISCOUNT', value: 20, serviceId: 'svc_corte_clasico', description: '20 % de descuento' },
        stampExpiry: 'NEVER',
        rewardValidityDays: 30,
        wallet: { apple: 'NOT_LINKED', google: 'NOT_LINKED' },
        isExampleConfiguration: true,
      },
    ],
    memberships: [
      { id: 'lm_mariana', businessId: ORBITA, customerId: named.mariana.id, stamps: 3, passUpdate: 'UP_TO_DATE' },
      { id: 'lm_diego', businessId: ORBITA, customerId: named.diego.id, stamps: 5, passUpdate: 'UP_TO_DATE' },
      { id: 'lm_carlos', businessId: ORBITA, customerId: named.carlos.id, stamps: 6, passUpdate: 'NOT_ISSUED' },
      ...generated.slice(0, 30).map((c, i) => ({ id: `lm_g${i}`, businessId: ORBITA, customerId: c.id, stamps: i % 7, passUpdate: 'UP_TO_DATE' as const })),
    ],
    ledger: [],
    processedEvents: new Set(),
    rewards: [
      {
        id: 'rwd_mariana',
        businessId: ORBITA,
        membershipId: 'lm_mariana',
        description: '20 % de descuento',
        serviceName: 'Corte clásico',
        status: 'AVAILABLE',
        validUntil: today.plus({ days: 19 }).endOf('day').toJSDate(),
      },
    ],
  };

  // ── Campañas (simulación; aún no se envía nada) ──
  const iso = (d: Date) => d.toISOString();
  const campaigns: CampaignState = {
    templates: [
      {
        id: 'tpl_volver',
        businessId: ORBITA,
        name: 'Invitación a volver',
        approval: 'PENDING',
        body: 'Hola, {{customerName}} 👋\nNos encantará verte de nuevo.\nDisfruta {{benefit}}.\nVálido {{validUntil}}, con cita previa.',
        variables: ['customerName', 'benefit', 'validUntil'],
      },
      {
        id: 'tpl_gracias',
        businessId: ORBITA,
        name: 'Gracias por tu visita',
        approval: 'APPROVED',
        body: 'Hola, {{customerName}}. ¡Gracias por elegirnos! Te esperamos pronto: {{benefit}}, {{validUntil}}.',
        variables: ['customerName', 'benefit', 'validUntil'],
      },
    ],
    campaigns: [
      {
        id: 'cmp_corte',
        businessId: ORBITA,
        name: 'Vuelve por tu próximo corte',
        objective: 'WIN_BACK',
        status: 'SCHEDULED',
        channel: 'WHATSAPP',
        audience: { mode: 'SEGMENT', segment: 'INACTIVE', inactiveDays: 60, excludeWithUpcoming: true },
        content: { templateId: 'tpl_gracias', benefit: '20 % de descuento en tu próximo corte', validUntil: 'hasta fin de mes' },
        schedule: { mode: 'SCHEDULED', date: today.plus({ days: 3 }).toISODate()!, time: '10:00' },
        scheduledAt: iso(at(3, '10:00')),
        eligibleCount: 42,
        results: null,
        sentAt: null,
        updatedAt: iso(at(-1, '18:00')),
        timeline: [
          { at: iso(at(-2, '17:40')), label: 'Borrador creado por Alberto' },
          { at: iso(at(-1, '18:00')), label: 'Programada por Alberto' },
        ],
      },
      {
        id: 'cmp_octubre',
        businessId: ORBITA,
        name: 'Especial de temporada',
        objective: 'PROMOTE_SERVICE',
        status: 'DRAFT',
        channel: 'WHATSAPP',
        audience: null,
        content: null,
        schedule: null,
        scheduledAt: null,
        eligibleCount: null,
        results: null,
        sentAt: null,
        updatedAt: iso(at(-2, '12:00')),
        timeline: [{ at: iso(at(-2, '12:00')), label: 'Borrador creado por Alberto' }],
      },
      {
        id: 'cmp_gracias',
        businessId: ORBITA,
        name: 'Gracias por volver',
        objective: 'THANK_YOU',
        status: 'FINISHED',
        channel: 'WHATSAPP',
        audience: { mode: 'SEGMENT', segment: 'FREQUENT', inactiveDays: 60, excludeWithUpcoming: false },
        content: { templateId: 'tpl_gracias', benefit: 'un detalle en tu próxima visita', validUntil: 'este mes' },
        schedule: { mode: 'NOW' },
        scheduledAt: iso(at(-4, '10:00')),
        eligibleCount: 60,
        results: { sent: 60, delivered: 54, failed: 3, replies: 7, attributedBookings: null },
        sentAt: iso(at(-4, '10:00')),
        updatedAt: iso(at(-4, '10:05')),
        timeline: [
          { at: iso(at(-5, '16:00')), label: 'Borrador creado por Alberto' },
          { at: iso(at(-5, '16:20')), label: 'Programada por Alberto' },
          { at: iso(at(-4, '10:00')), label: 'Envío iniciado' },
          { at: iso(at(-4, '10:05')), label: 'Finalizada: 60 enviados, 3 con error' },
        ],
      },
    ],
  };

  // ── Notas internas por rol ──
  s.customerNotes.push(
    { id: 'note_seed_1', businessId: ORBITA, customerId: named.mariana.id, body: 'Prefiere que le laven el cabello con agua tibia. Le gusta el café sin azúcar.', visibility: 'TEAM', authorId: 'u_ana', authorName: 'Ana', createdAt: today.minus({ days: 22 }).set({ hour: 11 }).toJSDate(), deletedAt: null },
    { id: 'note_seed_2', businessId: ORBITA, customerId: named.mariana.id, body: 'Una vez pagó con tarjeta rechazada; en servicios de más de $800 pedir anticipo.', visibility: 'ADMINS', authorId: 'u_alberto', authorName: 'Alberto', createdAt: today.minus({ days: 40 }).set({ hour: 18 }).toJSDate(), deletedAt: null },
  );
  void diegoDup;

  // ── Privacidad: historial de consentimiento y solicitudes de derechos (sección 14) ──
  let cnsSeq = 0;
  const consent = (c: Customer, status: Customer['promotionalConsent'], source: 'STAFF_APP' | 'WHATSAPP', evidence: string, atDate: Date) =>
    s.consents.push({ id: `cns_seed_${++cnsSeq}`, businessId: c.businessId, customerId: c.id, status, source, actorId: source === 'WHATSAPP' ? 'channel:whatsapp' : 'u_rocio', actorName: source === 'WHATSAPP' ? 'WhatsApp' : 'Rocío', evidence, at: atDate });
  named.fernanda.promotionalConsent = 'GRANTED';
  for (const c of s.customers.filter((x) => x.businessId === ORBITA)) {
    if (c.promotionalConsent === 'NOT_GRANTED') continue;
    const viaWa = Number(c.id.slice(-1)) % 2 === 0;
    consent(c, 'GRANTED', viaWa ? 'WHATSAPP' : 'STAFF_APP', viaWa ? 'Respondió "Sí" al mensaje de bienvenida' : 'Lo aceptó en mostrador', c.createdAt);
    if (c.promotionalConsent === 'REVOKED') {
      consent(c, 'REVOKED', 'WHATSAPP', 'Respondió "BAJA" a una promoción', DateTime.fromJSDate(c.createdAt).plus({ days: 60 }).toJSDate());
    }
  }
  const withAppointments = new Set(s.appointments.map((a) => a.customerId));
  const quiet = generated.find((c) => !withAppointments.has(c.id)) ?? generated[0]!;
  const prv = (id: string, c: Customer, type: 'ACCESS' | 'RECTIFICATION' | 'CANCELLATION' | 'OPPOSITION', channel: 'IN_PERSON' | 'WHATSAPP' | 'EMAIL' | 'PHONE', details: string, receivedDays: number, end?: { status: 'IN_PROGRESS' | 'COMPLETED'; days: number; note: string }) => {
    const receivedAt = today.minus({ days: receivedDays }).set({ hour: 11 }).toJSDate();
    const history: Array<{ at: Date; status: 'RECEIVED' | 'IN_PROGRESS' | 'COMPLETED'; actorName: string; note: string | null }> = [{ at: receivedAt, status: 'RECEIVED', actorName: 'Rocío', note: null }];
    if (end) history.push({ at: today.minus({ days: end.days }).set({ hour: 8, minute: 30 }).toJSDate(), status: end.status, actorName: 'Alberto', note: end.note });
    s.privacyRequests.push({
      id,
      businessId: ORBITA,
      customerId: c.id,
      type,
      status: end?.status ?? 'RECEIVED',
      channel,
      details,
      receivedAt,
      resolvedAt: end?.status === 'COMPLETED' ? history[history.length - 1]!.at : null,
      resolution: end?.status === 'COMPLETED' ? end.note : null,
      history,
    });
  };
  prv('prv_seed_1', named.fernanda, 'OPPOSITION', 'WHATSAPP', 'Pidió no recibir más promociones, pero sí sus recordatorios de cita.', 2);
  prv('prv_seed_2', quiet, 'CANCELLATION', 'IN_PERSON', 'Se muda de ciudad y pidió que se borren sus datos.', 1, { status: 'IN_PROGRESS', days: 0, note: 'Verificamos su identidad en mostrador.' });
  prv('prv_seed_3', named.diego, 'ACCESS', 'EMAIL', 'Quiere saber qué datos guardamos.', 9, { status: 'COMPLETED', days: 6, note: 'Se le envió la exportación de sus datos por correo.' });

  return { db: s, loyalty, campaigns };
}
