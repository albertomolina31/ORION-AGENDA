import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/**
 * Estado de conexión (P42). Distingue dispositivo sin red de servidor inalcanzable.
 * Sin conexión: se leen datos guardados (marcados con su hora) y se bloquean las
 * acciones transaccionales; nunca se anuncia una reserva o un canje sin respuesta.
 */
type State = { device: boolean; server: boolean };
let state: State = { device: true, server: true };
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  const merged = { ...state, ...next };
  if (merged.device === state.device && merged.server === state.server) return;
  state = merged;
  listeners.forEach((l) => l());
}

// Sin "ping" a servidores de terceros: la alcanzabilidad real la marca nuestra propia API.
NetInfo.configure({ reachabilityShouldRun: () => false });
NetInfo.addEventListener((s) => set({ device: s.isConnected !== false }));

// En web, NetInfo solo escucha `navigator.connection` (si existe), que no avisa de online/offline.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && typeof navigator !== 'undefined') {
  const sync = () => set({ device: navigator.onLine !== false });
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
}

// React Query pausa las consultas sin red y reanuda al volver (sin reintentos en vano).
onlineManager.setEventListener((setOnline) => {
  const listener = () => setOnline(state.device);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
});

/** Lo llama el cliente API: un fallo de red marca el servidor como inalcanzable; cualquier respuesta lo restablece. */
export function reportServerReachable(ok: boolean) {
  set({ server: ok });
}

export function isOnlineNow(): boolean {
  return state.device && state.server;
}

export function useNetwork(): { online: boolean; reason: 'device' | 'server' | null } {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
  return { online: snap.device && snap.server, reason: !snap.device ? 'device' : !snap.server ? 'server' : null };
}
