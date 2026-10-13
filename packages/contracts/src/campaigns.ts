import { z } from 'zod';
import { Id, IsoDateTime, LocalDate, LocalTime, RequestId } from './common.js';

export const CampaignStatus = z.enum(['DRAFT', 'SCHEDULED', 'SENDING', 'PAUSED', 'FINISHED', 'CANCELLED']);
export type CampaignStatus = z.infer<typeof CampaignStatus>;

export const CampaignObjective = z.enum(['WIN_BACK', 'PROMOTE_SERVICE', 'THANK_YOU']);
export type CampaignObjective = z.infer<typeof CampaignObjective>;

export const AudienceSegment = z.enum(['INACTIVE', 'FREQUENT', 'NEAR_REWARD']);
export type AudienceSegment = z.infer<typeof AudienceSegment>;

export const AudienceDefinition = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('SEGMENT'),
    segment: AudienceSegment,
    inactiveDays: z.number().int().min(7).max(730).default(60),
    excludeWithUpcoming: z.boolean().default(true),
  }),
  z.object({
    mode: z.literal('MANUAL'),
    customerIds: z.array(Id).max(500),
  }),
]);
export type AudienceDefinition = z.infer<typeof AudienceDefinition>;

export const AudiencePreview = z.object({
  matched: z.number().int(),
  eligible: z.number().int(),
  excluded: z.object({
    noConsent: z.number().int(),
    optedOut: z.number().int(),
  }),
  sample: z.array(z.object({ id: Id, name: z.string() })),
  calculatedAt: IsoDateTime,
});
export type AudiencePreview = z.infer<typeof AudiencePreview>;

/** Aprobación de plantilla se representa aparte del estado de campaña (sección 27). */
export const TemplateApproval = z.enum(['APPROVED', 'PENDING', 'REJECTED']);

export const MessageTemplate = z.object({
  id: Id,
  name: z.string(),
  approval: TemplateApproval,
  body: z.string(),
  variables: z.array(z.enum(['customerName', 'benefit', 'validUntil'])),
});
export type MessageTemplate = z.infer<typeof MessageTemplate>;

export const CampaignContent = z.object({
  templateId: Id,
  benefit: z.string().trim().max(80),
  validUntil: z.string().trim().max(40),
});

export const CampaignSchedule = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('NOW') }),
  z.object({ mode: z.literal('SCHEDULED'), date: LocalDate, time: LocalTime }),
]);

export const Campaign = z.object({
  id: Id,
  name: z.string(),
  objective: CampaignObjective,
  status: CampaignStatus,
  channel: z.literal('WHATSAPP'),
  audience: AudienceDefinition.nullable(),
  content: CampaignContent.nullable(),
  schedule: CampaignSchedule.nullable(),
  scheduledAt: IsoDateTime.nullable(),
  eligibleCount: z.number().int().nullable(),
  /** Solo métricas realmente disponibles; null = no disponible. */
  results: z
    .object({
      sent: z.number().int(),
      delivered: z.number().int().nullable(),
      failed: z.number().int().nullable(),
      replies: z.number().int().nullable(),
      /** Reservas atribuibles: null hasta definir enlace y ventana de atribución. */
      attributedBookings: z.number().int().nullable(),
    })
    .nullable(),
  /** Historial de estados de la campaña. */
  timeline: z.array(z.object({ at: IsoDateTime, label: z.string() })),
  sentAt: IsoDateTime.nullable(),
  updatedAt: IsoDateTime,
});
export type Campaign = z.infer<typeof Campaign>;

export const SaveCampaignRequest = z.object({
  requestId: RequestId,
  name: z.string().trim().min(3, 'Escribe al menos 3 caracteres').max(60),
  objective: CampaignObjective,
  audience: AudienceDefinition.nullable().optional(),
  content: CampaignContent.nullable().optional(),
  schedule: CampaignSchedule.nullable().optional(),
});
export type SaveCampaignRequest = z.input<typeof SaveCampaignRequest>;

export const ConfirmCampaignRequest = z.object({ requestId: RequestId });
