import type {
  CreateCustomerNoteRequest,
  MergeCustomersRequest,
  MergePreview,
  UpdateCustomerRequest,
  AnonymizeCustomerRequest,
  CreatePrivacyRequest,
  CustomerDataExport,
  PrivacyOverview,
  PrivacyRequest,
  PrivacyRequestAction,
  PrivacyRequestTransition,
  UpdateConsentRequest,
  PolicyChangeResult,
  PolicyHistoryItem,
  UpdatePolicyRequest,
  UpdateProfileRequest,
  Block,
  CreateBlockRequest,
  ExceptionRequest,
  MarkNotificationsRequest,
  NotificationsResponse,
  SaveProfessionalRequest,
  SaveServiceRequest,
  ScheduleChangeResult,
  ScheduleConflict,
  WeeklyHoursRequest,
  AgendaResponse,
  Appointment,
  AppointmentAction,
  AppointmentDetail,
  AudienceDefinition,
  AudiencePreview,
  AvailabilityResponse,
  BusinessProfile,
  Campaign,
  CreateAppointmentRequest,
  CreateCustomerRequest,
  CustomerDetail,
  CustomerListQuery,
  CustomerListResponse,
  DevUser,
  HomeSummary,
  LoyaltyMembership,
  LoyaltyProgram,
  MeResponse,
  MessageTemplate,
  OperationResult,
  Professional,
  RedemptionResult,
  RescheduleRequest,
  SaveCampaignRequest,
  SchedulesResponse,
  Service,
  SessionResponse,
} from '@orion/contracts';
import { api } from './api-client';

/** Cliente tipado del contrato v1. Los tipos vienen de @orion/contracts, no se copian a mano. */
const b = (businessId: string) => `/businesses/${encodeURIComponent(businessId)}`;

export const endpoints = {
  devUsers: () => api<DevUser[]>('GET', '/auth/dev-users'),
  devLogin: (userId: string) => api<SessionResponse>('POST', '/auth/dev-login', { body: { userId } }),
  logout: () => api<void>('POST', '/auth/logout'),
  me: () => api<MeResponse>('GET', '/me'),
  simulationStatus: () => api<{ dataSource: 'SIMULATION'; now: string; notice: string }>('GET', '/simulation/status'),
  operation: (requestId: string) => api<OperationResult>('GET', `/operations/${requestId}`),

  profile: (bid: string) => api<BusinessProfile>('GET', b(bid)),
  home: (bid: string) => api<HomeSummary>('GET', `${b(bid)}/home`),
  services: (bid: string) => api<Service[]>('GET', `${b(bid)}/services`),
  professionals: (bid: string) => api<Professional[]>('GET', `${b(bid)}/professionals`),
  schedules: (bid: string) => api<SchedulesResponse>('GET', `${b(bid)}/schedules`),

  agenda: (bid: string, q: { from: string; to?: string; professionalId?: string; status?: string[] }) =>
    api<AgendaResponse>('GET', `${b(bid)}/appointments`, {
      query: { from: q.from, to: q.to, professionalId: q.professionalId, status: q.status?.join(',') },
    }),
  appointment: (bid: string, id: string) => api<AppointmentDetail>('GET', `${b(bid)}/appointments/${id}`),
  availability: (bid: string, q: { serviceId: string; professionalId?: string; date: string; excludeAppointmentId?: string }) =>
    api<AvailabilityResponse>('GET', `${b(bid)}/availability`, { query: q }),
  createAppointment: (bid: string, body: CreateAppointmentRequest) => api<Appointment>('POST', `${b(bid)}/appointments`, { body }),
  transition: (bid: string, id: string, action: Exclude<AppointmentAction, 'reschedule'>, body: { requestId: string; expectedVersion: number; reason?: string }) =>
    api<Appointment>('POST', `${b(bid)}/appointments/${id}/${action}`, { body }),
  reschedule: (bid: string, id: string, body: RescheduleRequest) => api<Appointment>('POST', `${b(bid)}/appointments/${id}/reschedule`, { body }),

  customers: (bid: string, q: CustomerListQuery) => api<CustomerListResponse>('GET', `${b(bid)}/customers`, { query: q as Record<string, string> }),
  customer: (bid: string, id: string) => api<CustomerDetail>('GET', `${b(bid)}/customers/${id}`),
  createCustomer: (bid: string, body: CreateCustomerRequest) => api<CustomerDetail>('POST', `${b(bid)}/customers`, { body }),
  updateCustomer: (bid: string, id: string, body: UpdateCustomerRequest) => api<CustomerDetail>('PATCH', `${b(bid)}/customers/${id}`, { body }),
  addCustomerNote: (bid: string, id: string, body: CreateCustomerNoteRequest) => api<CustomerDetail>('POST', `${b(bid)}/customers/${id}/notes`, { body }),
  deleteCustomerNote: (bid: string, id: string, noteId: string, body: { requestId: string }) =>
    api<CustomerDetail>('POST', `${b(bid)}/customers/${id}/notes/${noteId}/delete`, { body }),
  mergePreview: (bid: string, id: string, duplicateId: string) => api<MergePreview>('GET', `${b(bid)}/customers/${id}/merge-preview`, { query: { with: duplicateId } }),
  mergeCustomers: (bid: string, id: string, body: MergeCustomersRequest) => api<CustomerDetail>('POST', `${b(bid)}/customers/${id}/merge`, { body }),
  updateConsent: (bid: string, id: string, body: UpdateConsentRequest) => api<CustomerDetail>('POST', `${b(bid)}/customers/${id}/consent`, { body }),
  exportCustomer: (bid: string, id: string) => api<CustomerDataExport>('GET', `${b(bid)}/customers/${id}/export`),
  anonymizeCustomer: (bid: string, id: string, body: AnonymizeCustomerRequest) => api<CustomerDetail>('POST', `${b(bid)}/customers/${id}/anonymize`, { body }),
  privacyOverview: (bid: string) => api<PrivacyOverview>('GET', `${b(bid)}/privacy`),
  privacyRequest: (bid: string, id: string) => api<PrivacyRequest>('GET', `${b(bid)}/privacy/requests/${id}`),
  createPrivacyRequest: (bid: string, body: CreatePrivacyRequest) => api<PrivacyRequest>('POST', `${b(bid)}/privacy/requests`, { body }),
  privacyTransition: (bid: string, id: string, action: PrivacyRequestAction, body: PrivacyRequestTransition) =>
    api<PrivacyRequest>('POST', `${b(bid)}/privacy/requests/${id}/${action}`, { body }),

  loyaltyProgram: (bid: string) => api<LoyaltyProgram>('GET', `${b(bid)}/loyalty/program`),
  loyaltyMemberships: (bid: string) => api<LoyaltyMembership[]>('GET', `${b(bid)}/loyalty/memberships`),
  membershipByCustomer: (bid: string, customerId: string) =>
    api<{ membership: LoyaltyMembership | null }>('GET', `${b(bid)}/loyalty/memberships/by-customer/${customerId}`),
  redeem: (bid: string, body: { requestId: string; rewardId: string; appointmentId: string | null }) =>
    api<RedemptionResult>('POST', `${b(bid)}/loyalty/redemptions`, { body }),

  updateProfile: (bid: string, body: UpdateProfileRequest) => api<BusinessProfile>('PATCH', `${b(bid)}/profile`, { body }),
  updatePolicy: (bid: string, body: UpdatePolicyRequest) => api<PolicyChangeResult>('POST', `${b(bid)}/policy`, { body }),
  policyHistory: (bid: string) => api<PolicyHistoryItem[]>('GET', `${b(bid)}/policy/history`),
  saveService: (bid: string, id: string | null, body: SaveServiceRequest) =>
    id ? api<Service>('PATCH', `${b(bid)}/services/${id}`, { body }) : api<Service>('POST', `${b(bid)}/services`, { body }),
  saveProfessional: (bid: string, id: string | null, body: SaveProfessionalRequest) =>
    id ? api<Professional>('PATCH', `${b(bid)}/professionals/${id}`, { body }) : api<Professional>('POST', `${b(bid)}/professionals`, { body }),
  futureAppointments: (bid: string, id: string) => api<ScheduleConflict[]>('GET', `${b(bid)}/professionals/${id}/future-appointments`),
  setProfessionalActive: (bid: string, id: string, active: boolean, requestId: string) =>
    api<Professional>('POST', `${b(bid)}/professionals/${id}/status`, { body: { requestId, active } }),
  setWeeklyHours: (bid: string, body: WeeklyHoursRequest) => api<ScheduleChangeResult>('POST', `${b(bid)}/schedules/weekly`, { body }),
  saveException: (bid: string, body: ExceptionRequest) => api<ScheduleChangeResult>('POST', `${b(bid)}/schedules/exceptions`, { body }),
  deleteException: (bid: string, id: string, requestId: string) => api<void>('POST', `${b(bid)}/schedules/exceptions/${id}/delete`, { body: { requestId } }),
  blocks: (bid: string, from: string, to: string) => api<Block[]>('GET', `${b(bid)}/blocks`, { query: { from, to } }),
  createBlock: (bid: string, body: CreateBlockRequest) => api<Block>('POST', `${b(bid)}/blocks`, { body }),
  removeBlock: (bid: string, id: string, requestId: string) => api<void>('POST', `${b(bid)}/blocks/${id}/remove`, { body: { requestId } }),

  notifications: (bid: string) => api<NotificationsResponse>('GET', `${b(bid)}/notifications`),
  markNotifications: (bid: string, body: MarkNotificationsRequest) => api<NotificationsResponse>('POST', `${b(bid)}/notifications/read`, { body }),

  campaignAction: (bid: string, id: string, action: 'pause' | 'resume' | 'cancel', requestId: string) =>
    api<Campaign>('POST', `${b(bid)}/campaigns/${id}/${action}`, { body: { requestId } }),
  campaigns: (bid: string) => api<Campaign[]>('GET', `${b(bid)}/campaigns`),
  campaign: (bid: string, id: string) => api<Campaign>('GET', `${b(bid)}/campaigns/${id}`),
  templates: (bid: string) => api<MessageTemplate[]>('GET', `${b(bid)}/campaigns/templates`),
  audiencePreview: (bid: string, body: AudienceDefinition) => api<AudiencePreview>('POST', `${b(bid)}/campaigns/audience-preview`, { body }),
  createCampaign: (bid: string, body: SaveCampaignRequest) => api<Campaign>('POST', `${b(bid)}/campaigns`, { body }),
  updateCampaign: (bid: string, id: string, body: SaveCampaignRequest) => api<Campaign>('PATCH', `${b(bid)}/campaigns/${id}`, { body }),
  confirmCampaign: (bid: string, id: string, requestId: string) => api<Campaign>('POST', `${b(bid)}/campaigns/${id}/confirm`, { body: { requestId } }),
};
