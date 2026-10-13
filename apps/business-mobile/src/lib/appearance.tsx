import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname } from 'expo-router';
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { colors, type ColorScheme, setColorScheme } from '@/ui/theme';

/** Preferencia de apariencia de este teléfono (no viaja al servidor). */
export type AppearancePreference = 'system' | 'light' | 'dark';
const KEY = 'orion.appearance';

interface AppearanceValue {
  preference: AppearancePreference;
  scheme: ColorScheme;
  setPreference: (p: AppearancePreference) => void;
}

const Ctx = createContext<AppearanceValue | null>(null);

/**
 * Modo claro/oscuro. Por defecto sigue al sistema. Al cambiar de tema, el layout raíz vuelve
 * a montar el navegador (`key={scheme}`): los estilos se recalculan con la paleta nueva,
 * la sesión y la caché se conservan y se regresa a la pantalla en la que estaba la persona.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<AppearancePreference | null>(null);
  const pathname = usePathname();
  const lastPath = useRef(pathname);
  const restoreTo = useRef<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setPref(v === 'light' || v === 'dark' ? v : 'system'))
      .catch(() => setPref('system'));
  }, []);

  const scheme: ColorScheme = preference === 'light' || preference === 'dark' ? preference : system === 'dark' ? 'dark' : 'light';
  const previous = useRef<ColorScheme | null>(null);
  if (previous.current !== scheme) {
    // Antes de renderizar a los hijos: los estilos de este render ya usan la paleta nueva.
    if (previous.current !== null) restoreTo.current = lastPath.current;
    setColorScheme(scheme);
    previous.current = scheme;
  }

  useEffect(() => {
    lastPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = colors.background;
      document.documentElement.style.colorScheme = scheme;
    }
    const target = restoreTo.current;
    restoreTo.current = null;
    if (target && target !== '/') {
      // El remontaje reinicia la navegación: volver a la pantalla actual.
      setTimeout(() => router.replace(target as never), 0);
    }
  }, [scheme]);

  if (preference === null) return null;
  const value: AppearanceValue = {
    preference,
    scheme,
    setPreference: (p) => {
      setPref(p);
      void AsyncStorage.setItem(KEY, p).catch(() => undefined);
    },
  };
  return (
    <Ctx.Provider value={value}>{children}</Ctx.Provider>
  );
}

export function useAppearance(): AppearanceValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppearance fuera de AppearanceProvider');
  return v;
}
