import type { AppointmentStatus, AppointmentSource } from './appointments.js';
import type { CampaignStatus } from './campaigns.js';
import type { Role } from './identity.js';

/** Etiquetas en español compartidas por app y bot. El estado siempre va con texto, no solo color. */
export const appointmentStatusLabel: Record<AppointmentStatus, string> = {
  PENDING_APPROVAL: 'Por aprobar',
  CONFIRMED: 'Confirmada',
  REJECTED: 'Rechazada',
  EXPIRED: 'Vencida',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
  NO_SHOW: 'No asistió',
};

export const appointmentSourceLabel: Record<AppointmentSource, string> = {
  STAFF_APP: 'App del negocio',
  WHATSAPP: 'WhatsApp',
  CONSUMER_LINK: 'Enlace de reserva',
};

export const roleLabel: Record<Role, string> = {
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  RECEPTION: 'Recepción',
  PROFESSIONAL: 'Profesional',
};

export const campaignStatusLabel: Record<CampaignStatus, string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  SENDING: 'En envío',
  PAUSED: 'Pausada',
  FINISHED: 'Finalizada',
  CANCELLED: 'Cancelada',
};
