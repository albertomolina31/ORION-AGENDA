import { z } from 'zod';
import { Id } from './common.js';

export const Role = z.enum(['OWNER', 'ADMIN', 'RECEPTION', 'PROFESSIONAL']);
export type Role = z.infer<typeof Role>;

export const Permission = z.enum([
  'agenda.view_all',
  'agenda.view_own',
  'appointments.manage_all',
  'appointments.manage_own',
  'appointments.complete_own',
  'appointments.approve',
  'customers.view_all',
  'customers.manage',
  /** Unir clientes duplicados (preserva citas, notas y fidelidad). */
  'customers.merge',
  /** Ver y escribir notas internas "solo dueño y administración". */
  'customers.notes_admin',
  'catalog.manage',
  'schedules.manage',
  'team.manage',
  'loyalty.view',
  'loyalty.redeem',
  'loyalty.configure',
  'campaigns.view',
  'campaigns.manage',
  'business.configure',
  /** Solicitudes de derechos, exportación y eliminación de datos de clientes. */
  'privacy.manage',
]);
export type Permission = z.infer<typeof Permission>;

export const BusinessCategory = z.enum(['HAIR_BEAUTY', 'NAILS_BEAUTY', 'CLINIC', 'CONSULTING', 'OTHER']);
export type BusinessCategory = z.infer<typeof BusinessCategory>;

/** La profesión cambia la presentación; el rol cambia permisos (sección 26). */
export const Vocabulary = z.object({
  customerSingular: z.string(),
  customerPlural: z.string(),
});
export type Vocabulary = z.infer<typeof Vocabulary>;

export const BusinessStatus = z.enum(['DRAFT', 'ACTIVE', 'SUSPENDED']);

export const MembershipSummary = z.object({
  businessId: Id,
  businessName: z.string(),
  category: BusinessCategory,
  categoryLabel: z.string(),
  timezone: z.string(),
  role: Role,
  roleLabel: z.string(),
  status: BusinessStatus,
  /** Profesional vinculado a este usuario dentro del negocio, si existe. */
  professionalId: Id.nullable(),
  permissions: z.array(Permission),
  vocabulary: Vocabulary,
  features: z.object({
    loyalty: z.boolean(),
    campaigns: z.boolean(),
  }),
});
export type MembershipSummary = z.infer<typeof MembershipSummary>;

export const DevUser = z.object({
  id: Id,
  name: z.string(),
  email: z.string(),
  description: z.string(),
});
export type DevUser = z.infer<typeof DevUser>;

export const DevLoginRequest = z.object({ userId: Id });
export type DevLoginRequest = z.infer<typeof DevLoginRequest>;

export const SessionResponse = z.object({
  accessToken: z.string(),
  user: z.object({ id: Id, name: z.string(), email: z.string() }),
  /** Siempre 'SIMULATED' hasta decidir la estrategia de identidad (sección 14). */
  authMode: z.literal('SIMULATED'),
});
export type SessionResponse = z.infer<typeof SessionResponse>;

export const MeResponse = z.object({
  user: z.object({ id: Id, name: z.string(), email: z.string() }),
  memberships: z.array(MembershipSummary),
});
export type MeResponse = z.infer<typeof MeResponse>;
