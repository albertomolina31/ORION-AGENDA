import type { AppointmentAction, Permission, Role } from '@orion/contracts';
import { DomainError } from './errors.js';
import type { ActorContext, Appointment, Membership } from './model.js';

/**
 * Matriz propuesta (sección 6). El backend decide cada autorización; ocultar botones
 * no protege datos. Permisos opcionales (campañas, ajustes de sellos, miembros) se
 * conceden explícitamente con `grants`.
 */
export const basePermissions: Record<Role, Permission[]> = {
  OWNER: [
    'agenda.view_all',
    'appointments.manage_all',
    'appointments.approve',
    'customers.view_all',
    'customers.manage',
    'catalog.manage',
    'schedules.manage',
    'team.manage',
    'loyalty.view',
    'loyalty.redeem',
    'loyalty.configure',
    'campaigns.view',
    'campaigns.manage',
    'business.configure',
  ],
  ADMIN: [
    'agenda.view_all',
    'appointments.manage_all',
    'appointments.approve',
    'customers.view_all',
    'customers.manage',
    'catalog.manage',
    'schedules.manage',
    'loyalty.view',
    'loyalty.redeem',
    'campaigns.view',
  ],
  RECEPTION: [
    'agenda.view_all',
    'appointments.manage_all',
    'appointments.approve',
    'customers.view_all',
    'customers.manage',
  ],
  PROFESSIONAL: ['agenda.view_own', 'appointments.complete_own'],
};

export function resolvePermissions(m: Pick<Membership, 'role' | 'grants' | 'revokes'>): Set<Permission> {
  const set = new Set<Permission>(basePermissions[m.role]);
  m.grants.forEach((p) => set.add(p));
  m.revokes.forEach((p) => set.delete(p));
  return set;
}

export function requirePermission(actor: ActorContext, permission: Permission): void {
  if (!actor.permissions.has(permission)) {
    throw new DomainError('FORBIDDEN', 'No tienes permiso para realizar esta acción.');
  }
}

export function canViewProfessionalAgenda(actor: ActorContext, professionalId: string): boolean {
  if (actor.permissions.has('agenda.view_all')) return true;
  return actor.permissions.has('agenda.view_own') && actor.professionalId === professionalId;
}

const ownActionPermission: Record<AppointmentAction, Permission> = {
  approve: 'appointments.manage_own',
  reject: 'appointments.manage_own',
  cancel: 'appointments.manage_own',
  reschedule: 'appointments.manage_own',
  complete: 'appointments.complete_own',
  'no-show': 'appointments.complete_own',
};

/** ¿Puede el actor ejecutar esta acción sobre esta cita (sin considerar el estado)? */
export function canActOn(actor: ActorContext, appt: Pick<Appointment, 'professionalId'>, action: AppointmentAction): boolean {
  if (action === 'approve' || action === 'reject') {
    if (actor.permissions.has('appointments.approve')) return true;
  } else if (actor.permissions.has('appointments.manage_all')) {
    return true;
  }
  const isOwn = actor.professionalId !== null && actor.professionalId === appt.professionalId;
  return isOwn && actor.permissions.has(ownActionPermission[action]);
}

export function canCreateFor(actor: ActorContext, professionalId: string | null): boolean {
  if (actor.permissions.has('appointments.manage_all')) return true;
  return (
    actor.permissions.has('appointments.manage_own') &&
    actor.professionalId !== null &&
    (professionalId === null || professionalId === actor.professionalId)
  );
}
