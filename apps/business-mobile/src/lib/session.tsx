import type { MembershipSummary, MeResponse } from '@orion/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, configureApiClient } from './api-client';
import { endpoints } from './endpoints';
import { secureStorage } from './secure-storage';

const TOKEN_KEY = 'orion.session.token';
const BUSINESS_KEY = 'orion.session.business';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface SessionValue {
  status: Status;
  me: MeResponse | null;
  /** Membresía activa, siempre revalidada contra /me (nunca un ID guardado a ciegas). */
  membership: MembershipSummary | null;
  signIn: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectBusiness: (businessId: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  can: (permission: MembershipSummary['permissions'][number]) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, err) => !(err instanceof ApiError && !err.uncertain) && count < 2,
        staleTime: 15_000,
        refetchOnWindowFocus: true,
      },
      // Las mutaciones nunca se reintentan solas: el reintento lo decide la persona con la misma clave.
      mutations: { retry: false },
    },
  });
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const [queryClient, setQueryClient] = useState(makeQueryClient);

  /** Cambiar de usuario o negocio descarta toda la caché privada anterior. */
  const resetCache = useCallback(() => {
    queryClient.clear();
    setQueryClient(makeQueryClient());
  }, [queryClient]);

  const clearLocal = useCallback(async () => {
    tokenRef.current = null;
    await secureStorage.remove(TOKEN_KEY);
    await secureStorage.remove(BUSINESS_KEY);
    setMe(null);
    setBusinessId(null);
    resetCache();
    setStatus('signedOut');
  }, [resetCache]);

  useEffect(() => {
    configureApiClient({
      getToken: () => tokenRef.current,
      onUnauthorized: () => {
        void clearLocal();
      },
    });
  }, [clearLocal]);

  const loadMe = useCallback(async (preferredBusiness: string | null) => {
    const data = await endpoints.me();
    setMe(data);
    const active = data.memberships;
    const chosen =
      active.find((m) => m.businessId === preferredBusiness)?.businessId ?? (active.length === 1 ? active[0]!.businessId : null);
    setBusinessId(chosen);
    if (chosen) await secureStorage.set(BUSINESS_KEY, chosen);
    setStatus('signedIn');
  }, []);

  useEffect(() => {
    void (async () => {
      const token = await secureStorage.get(TOKEN_KEY);
      if (!token) return setStatus('signedOut');
      tokenRef.current = token;
      try {
        await loadMe(await secureStorage.get(BUSINESS_KEY));
      } catch {
        await clearLocal();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<SessionValue>(() => {
    const membership = me?.memberships.find((m) => m.businessId === businessId) ?? null;
    return {
      status,
      me,
      membership,
      signIn: async (userId) => {
        const session = await endpoints.devLogin(userId);
        tokenRef.current = session.accessToken;
        await secureStorage.set(TOKEN_KEY, session.accessToken);
        resetCache();
        await loadMe(null);
      },
      signOut: async () => {
        try {
          await endpoints.logout();
        } catch {
          /* el token se elimina localmente aunque el servidor no responda */
        }
        await clearLocal();
      },
      selectBusiness: async (id) => {
        resetCache();
        await loadMe(id);
      },
      refreshMe: () => loadMe(businessId),
      can: (p) => !!membership?.permissions.includes(p),
    };
  }, [status, me, businessId, resetCache, loadMe, clearLocal]);

  return (
    <SessionContext.Provider value={value}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession fuera de SessionProvider');
  return ctx;
}

/** Negocio activo garantizado dentro de las rutas protegidas. */
export function useBusiness(): MembershipSummary {
  const { membership } = useSession();
  if (!membership) throw new Error('Sin negocio activo');
  return membership;
}
