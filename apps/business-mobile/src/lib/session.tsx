import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MembershipSummary, MeResponse } from '@orion/contracts';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, configureApiClient } from './api-client';
import { endpoints } from './endpoints';
import { useNetwork } from './network';
import { secureStorage } from './secure-storage';
import { clearNativeWidgets } from '@/widgets/native-bridge';

const TOKEN_KEY = 'orion.session.token';
const BUSINESS_KEY = 'orion.session.business';
/** Copia de /me para poder abrir la app sin conexión (datos no secretos, almacenamiento privado de la app). */
const ME_KEY = 'orion.session.me';
const CACHE_KEY = 'orion.cache';
const WIDGET_SNAPSHOT_KEY = 'orion.widget.snapshot';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

type Status = 'loading' | 'signedOut' | 'signedIn';

interface SessionValue {
  status: Status;
  me: MeResponse | null;
  /** Membresía activa, revalidada contra /me cuando hay conexión. */
  membership: MembershipSummary | null;
  /** true si la sesión se abrió con datos guardados porque no había conexión. */
  offlineSession: boolean;
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
        gcTime: CACHE_MAX_AGE,
        refetchOnWindowFocus: true,
      },
      // Las mutaciones nunca se reintentan solas ni se encolan sin conexión.
      mutations: { retry: false, networkMode: 'always' },
    },
  });
}

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: CACHE_KEY, throttleTime: 1000 });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [offlineSession, setOfflineSession] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const [queryClient, setQueryClient] = useState(makeQueryClient);

  /** Cambiar de usuario o negocio descarta toda la caché privada anterior (memoria y disco). */
  const resetCache = useCallback(async () => {
    queryClient.clear();
    await AsyncStorage.removeItem(CACHE_KEY).catch(() => undefined);
    // La instantánea de los widgets sigue la misma regla que la caché (ver lib/widgets.ts).
    await AsyncStorage.removeItem(WIDGET_SNAPSHOT_KEY).catch(() => undefined);
    await clearNativeWidgets().catch(() => undefined);
    setQueryClient(makeQueryClient());
  }, [queryClient]);

  const clearLocal = useCallback(async () => {
    tokenRef.current = null;
    await secureStorage.remove(TOKEN_KEY);
    await secureStorage.remove(BUSINESS_KEY);
    await AsyncStorage.removeItem(ME_KEY).catch(() => undefined);
    setMe(null);
    setBusinessId(null);
    setOfflineSession(false);
    await resetCache();
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

  const applyMe = useCallback(async (data: MeResponse, preferredBusiness: string | null) => {
    setMe(data);
    const chosen =
      data.memberships.find((m) => m.businessId === preferredBusiness)?.businessId ?? (data.memberships.length === 1 ? data.memberships[0]!.businessId : null);
    setBusinessId(chosen);
    if (chosen) await secureStorage.set(BUSINESS_KEY, chosen);
    setStatus('signedIn');
  }, []);

  const loadMe = useCallback(
    async (preferredBusiness: string | null) => {
      const data = await endpoints.me();
      await AsyncStorage.setItem(ME_KEY, JSON.stringify(data)).catch(() => undefined);
      setOfflineSession(false);
      await applyMe(data, preferredBusiness);
    },
    [applyMe],
  );

  useEffect(() => {
    void (async () => {
      const token = await secureStorage.get(TOKEN_KEY);
      if (!token) return setStatus('signedOut');
      tokenRef.current = token;
      const preferred = await secureStorage.get(BUSINESS_KEY);
      try {
        await loadMe(preferred);
      } catch (err) {
        // Sin conexión: se abre con la última copia conocida; se revalida al recuperar la red.
        const cached = await AsyncStorage.getItem(ME_KEY).catch(() => null);
        if (err instanceof ApiError && err.uncertain && cached) {
          setOfflineSession(true);
          await applyMe(JSON.parse(cached) as MeResponse, preferred);
        } else {
          await clearLocal();
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al recuperar la conexión se revalida la sesión abierta con datos guardados.
  const { online } = useNetwork();
  useEffect(() => {
    if (online && offlineSession && status === 'signedIn') void loadMe(businessId).catch(() => undefined);
  }, [online, offlineSession, status, businessId, loadMe]);

  const value = useMemo<SessionValue>(() => {
    const membership = me?.memberships.find((m) => m.businessId === businessId) ?? null;
    return {
      status,
      me,
      membership,
      offlineSession,
      signIn: async (userId) => {
        const session = await endpoints.devLogin(userId);
        tokenRef.current = session.accessToken;
        await secureStorage.set(TOKEN_KEY, session.accessToken);
        await resetCache();
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
        await resetCache();
        await loadMe(id);
      },
      refreshMe: () => loadMe(businessId),
      can: (p) => !!membership?.permissions.includes(p),
    };
  }, [status, me, businessId, offlineSession, resetCache, loadMe, clearLocal]);

  // La caché en disco lleva usuario y negocio en su "buster": la de otra sesión se descarta.
  const buster = `${me?.user.id ?? 'anon'}:${businessId ?? 'none'}`;
  return (
    <SessionContext.Provider value={value}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: CACHE_MAX_AGE,
          buster,
          dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' && q.queryKey[0] !== 'dev-users' },
        }}
      >
        {children}
      </PersistQueryClientProvider>
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
