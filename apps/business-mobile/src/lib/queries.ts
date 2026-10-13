import type { CustomerListQuery } from '@orion/contracts';
import { useQuery } from '@tanstack/react-query';
import { endpoints } from './endpoints';
import { useBusiness } from './session';

/** Claves de caché siempre prefijadas por negocio. */
export const qk = {
  home: (bid: string) => ['home', bid] as const,
  agenda: (bid: string, ...rest: unknown[]) => ['agenda', bid, ...rest] as const,
  appointment: (bid: string, id: string) => ['appointment', bid, id] as const,
  customers: (bid: string, q: unknown) => ['customers', bid, q] as const,
  customer: (bid: string, id: string) => ['customer', bid, id] as const,
};

export function useHome() {
  const { businessId } = useBusiness();
  return useQuery({ queryKey: qk.home(businessId), queryFn: () => endpoints.home(businessId) });
}

export function useProfile() {
  const { businessId } = useBusiness();
  return useQuery({ queryKey: ['profile', businessId], queryFn: () => endpoints.profile(businessId) });
}

export function useServices() {
  const { businessId } = useBusiness();
  return useQuery({ queryKey: ['services', businessId], queryFn: () => endpoints.services(businessId), staleTime: 60_000 });
}

export function useProfessionals() {
  const { businessId } = useBusiness();
  return useQuery({ queryKey: ['professionals', businessId], queryFn: () => endpoints.professionals(businessId), staleTime: 60_000 });
}

export function useAgenda(q: { from: string; to?: string; professionalId?: string; status?: string[] }, enabled = true) {
  const { businessId } = useBusiness();
  return useQuery({ queryKey: qk.agenda(businessId, q), queryFn: () => endpoints.agenda(businessId, q), enabled });
}

export function useAppointment(id: string) {
  const { businessId } = useBusiness();
  return useQuery({ queryKey: qk.appointment(businessId, id), queryFn: () => endpoints.appointment(businessId, id) });
}

export function useCustomers(q: CustomerListQuery) {
  const { businessId } = useBusiness();
  return useQuery({ queryKey: qk.customers(businessId, q), queryFn: () => endpoints.customers(businessId, q) });
}

export function useCustomer(id: string) {
  const { businessId } = useBusiness();
  return useQuery({ queryKey: qk.customer(businessId, id), queryFn: () => endpoints.customer(businessId, id) });
}
