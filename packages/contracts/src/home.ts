import { z } from 'zod';
import { IsoDateTime, LocalDate } from './common.js';
import { Appointment } from './appointments.js';
import { Integration } from './business.js';

/** UI04 Inicio: resumen; la operación detallada vive en Agenda. */
export const HomeSummary = z.object({
  date: LocalDate,
  timezone: z.string(),
  /** Citas del día que siguen vigentes: CONFIRMED + PENDING_APPROVAL. */
  scheduledCount: z.number().int(),
  pendingApprovalCount: z.number().int(),
  confirmedCount: z.number().int(),
  /** Citas de hoy ya atendidas (COMPLETED). */
  completedCount: z.number().int(),
  activeProfessionals: z.number().int(),
  nextAppointment: Appointment.nullable(),
  whatsapp: Integration.nullable(),
  notices: z.array(z.object({ id: z.string(), title: z.string(), body: z.string() })),
  generatedAt: IsoDateTime,
});
export type HomeSummary = z.infer<typeof HomeSummary>;
