import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildWidgetSnapshot, effectiveWidgetPrivacy, weekStart, type WidgetPrivacy, type WidgetSnapshot } from '@orion/contracts';
import { useEffect, useMemo, useState } from 'react';
import { clearNativeWidgets, syncNativeWidgets } from '@/widgets/native-bridge';
import { addDays } from './format';
import { useAgenda, useHome, useProfile, useSchedules } from './queries';
import { useBusiness, useSession } from './session';

/**
 * Widgets de inicio (docs/widgets-plan.md).
 * La app arma la instantánea, la guarda (Android la lee en segundo plano) y la entrega a los
 * widgets nativos: iOS con expo-widgets (timeline precalculada) y Android con
 * react-native-android-widget. En web y Expo Go no hay widgets: solo la vista previa.
 */
const SNAPSHOT_KEY = 'orion.widget.snapshot';
const prefKey = (userId: string, businessId: string) => `orion.widget.privacy.${userId}.${businessId}`;

const RESYNC_MS = 15 * 60_000;
let lastSync: { key: string; at: number } | null = null;

/** Contenido sin la hora de generación: si no cambió, no se recargan los widgets. */
function contentKey(s: WidgetSnapshot): string {
  const { generatedAt: _g, generatedAtLabel: _l, ...rest } = s;
  return JSON.stringify(rest);
}

export const widgetBridge = {
  async setSnapshot(snapshot: WidgetSnapshot): Promise<void> {
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot)).catch(() => undefined);
    // WidgetKit limita las recargas: solo si cambió el contenido o para refrescar "Actualizado".
    const key = contentKey(snapshot);
    const now = Date.now();
    if (lastSync && lastSync.key === key && now - lastSync.at < RESYNC_MS) return;
    lastSync = { key, at: now };
    await syncNativeWidgets(snapshot).catch(() => undefined);
  },
  /** Cerrar sesión o cambiar de negocio borra la instantánea (los widgets muestran "Abre Orion"). */
  async clear(): Promise<void> {
    lastSync = null;
    await AsyncStorage.removeItem(SNAPSHOT_KEY).catch(() => undefined);
    await clearNativeWidgets().catch(() => undefined);
  },
};

/** Preferencia de cada persona en este teléfono; el negocio fija el máximo visible. */
export function useWidgetPrivacyPreference(): [WidgetPrivacy | null, (p: WidgetPrivacy) => Promise<void>] {
  const { me } = useSession();
  const { businessId } = useBusiness();
  const key = prefKey(me?.user.id ?? 'anon', businessId);
  const [value, setValue] = useState<WidgetPrivacy | null>(null);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key)
      .then((v) => alive && setValue(v === 'FULL' || v === 'INITIALS' || v === 'HIDDEN' ? v : null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [key]);
  const save = async (p: WidgetPrivacy) => {
    setValue(p);
    await AsyncStorage.setItem(key, p).catch(() => undefined);
  };
  return [value, save];
}

/** Instantánea calculada con los mismos datos (ya filtrados por permisos) que ve la app. */
export function useWidgetSnapshot(override?: { privacy?: WidgetPrivacy }): { snapshot: WidgetSnapshot | null; loading: boolean } {
  const { businessId, businessName } = useBusiness();
  const home = useHome();
  const profile = useProfile();
  const schedules = useSchedules();
  const [preference] = useWidgetPrivacyPreference();
  const today = home.data?.date;
  const from = today ? weekStart(today) : '';
  const week = useAgenda({ from, to: from ? addDays(from, 6) : undefined }, !!today);

  const businessMax = profile.data?.widgetPrivacy ?? 'INITIALS';
  const privacy = override?.privacy ?? effectiveWidgetPrivacy(businessMax, preference);
  const snapshot = useMemo(() => {
    if (!today || !home.data || !week.data) return null;
    return buildWidgetSnapshot({
      now: new Date(home.data.generatedAt),
      business: { id: businessId, name: profile.data?.name ?? businessName, timezone: home.data.timezone },
      privacy,
      today,
      week: week.data,
      schedules: schedules.data ?? null,
    });
  }, [today, home.data, week.data, schedules.data, privacy, businessId, businessName, profile.data?.name]);
  return { snapshot, loading: !snapshot && (home.isLoading || week.isLoading) };
}

/** Montado dentro de la sesión: escribe la instantánea tras cada carga o cambio de datos. */
export function WidgetSync() {
  const { snapshot } = useWidgetSnapshot();
  useEffect(() => {
    if (snapshot) void widgetBridge.setSnapshot(snapshot);
  }, [snapshot]);
  return null;
}
