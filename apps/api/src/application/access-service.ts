import type { DevUser, MeResponse, MembershipSummary } from '@orion/contracts';
import { roleLabel } from '@orion/contracts';
import { DomainError } from '../domain/errors.js';
import type { ActorContext } from '../domain/model.js';
import { resolvePermissions } from '../domain/permissions.js';
import type { Repositories } from './ports.js';
import { categoryLabel, vocabularyFor } from './presentation.js';

const devUserDescriptions: Record<string, string> = {
  u_alberto: 'Dueño · Estudio Órbita y Consultorio Luna',
  u_carmen: 'Administradora · Estudio Órbita',
  u_rocio: 'Recepción · Estudio Órbita',
  u_ana: 'Profesional · Estudio Órbita (Ana)',
};

export class AccessService {
  constructor(private readonly repos: Repositories) {}

  /** Login simulado: solo usuarios sintéticos. Sustituir por la estrategia de identidad (sección 14). */
  async devUsers(): Promise<DevUser[]> {
    const users = await this.repos.users.list();
    return users
      .filter((u) => u.active)
      .map((u) => ({ id: u.id, name: u.name, email: u.email, description: devUserDescriptions[u.id] ?? '' }));
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.repos.users.get(userId);
    if (!user || !user.active) throw new DomainError('UNAUTHENTICATED', 'Tu sesión ya no es válida.');
    const memberships = (await this.repos.memberships.listByUser(userId)).filter((m) => m.active);
    const summaries: MembershipSummary[] = [];
    for (const m of memberships) {
      const b = await this.repos.businesses.get(m.businessId);
      if (!b) continue;
      const permissions = [...resolvePermissions(m)];
      summaries.push({
        businessId: b.id,
        businessName: b.name,
        category: b.category,
        categoryLabel: categoryLabel[b.category],
        timezone: b.timezone,
        role: m.role,
        roleLabel: roleLabel[m.role],
        status: b.status,
        professionalId: m.professionalId,
        permissions,
        vocabulary: vocabularyFor(b.category),
        features: {
          loyalty: b.features.loyalty && permissions.includes('loyalty.view'),
          campaigns: b.features.campaigns && permissions.includes('campaigns.view'),
        },
      });
    }
    return { user: { id: user.id, name: user.name, email: user.email }, memberships: summaries };
  }

  /** Revalida usuario y membresía en cada operación; nunca confía en un businessId guardado. */
  async resolveActor(userId: string, businessId: string, correlationId: string): Promise<ActorContext> {
    const user = await this.repos.users.get(userId);
    if (!user || !user.active) throw new DomainError('UNAUTHENTICATED', 'Tu sesión ya no es válida.');
    const m = await this.repos.memberships.get(userId, businessId);
    const b = await this.repos.businesses.get(businessId);
    // Misma respuesta si el negocio no existe o no hay acceso: no filtrar existencia.
    if (!m || !m.active || !b) throw new DomainError('FORBIDDEN', 'No tienes acceso a este negocio.');
    return {
      userId,
      userName: user.name,
      businessId,
      role: m.role,
      permissions: resolvePermissions(m),
      professionalId: m.professionalId,
      channel: 'STAFF_APP',
      correlationId,
    };
  }
}
