import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildWidgetSnapshot, effectiveWidgetPrivacy, weekStart, type WidgetPrivacy, type WidgetSnapshot } from '@orion/contracts';
import { useEffect, useMemo, useState } from 'react';
import { addDays } from './format';
import { useAgenda, useHome, useProfile, useSchedules } from './queries';
import { useBusiness, useSession } from './session';

/**
 * Widgets de inicio (docs/widgets-plan.md, pasos W1–W3).
 * La app arma la instantánea y la deja donde el widget nativo la lee. Mientras no exista el
 * módulo nativo `widget-bridge` (requiere development build), la instantánea se guarda en el
 * almacenamiento de la app: SIMULACIÓN para la vista previa, ningún widget real la lee aún.
 */
const SNAPSHOT_KEY = 'orion.widget.snapshot';
const prefKey = (userId: string, businessId: string) => `orion.widget.privacy.${userId}.${businessId}`;

/** Puente hacia el widget nativo. Fase 1 sin módulo nativo: solo almacenamiento local. */
export const widgetBridge = {
  async setSnapshot(snapshot: WidgetSnapshot): Promise<void> {
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot)).catch(() => undefined);
    // Con development build: WidgetBridge.setSnapshot(json) + reloadWidgets() (App Group / SharedPreferences).
  },
  /** Cerrar sesión o cambiar de negocio borra la instantánea (los widgets muestran "Abre Orion"). */
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(SNAPSHOT_KEY).catch(() => undefined);
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
