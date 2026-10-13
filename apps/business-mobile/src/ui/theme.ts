import {
  colors as lightColors,
  type ColorToken,
  darkColors,
  darkProfessionalColors,
  professionalColors as lightProfessionalColors,
  radius,
  shadow,
  spacing,
  touchTarget,
  typography,
} from '@orion/design-tokens';

export { radius, shadow, spacing, touchTarget, typography };

export type ColorScheme = 'light' | 'dark';

let scheme: ColorScheme = 'light';
let version = 0;

/**
 * Colores del tema activo. Es un objeto "vivo": `setColorScheme` reemplaza sus valores,
 * así que `colors.text` leído durante el render siempre corresponde al tema actual.
 * Lo que se calcula a nivel de módulo (StyleSheet, mapas de tonos) va dentro de `themed()`.
 */
export const colors: Record<ColorToken, string> = { ...lightColors };

export function setColorScheme(next: ColorScheme): void {
  if (next === scheme) return;
  scheme = next;
  version += 1;
  Object.assign(colors, next === 'dark' ? darkColors : lightColors);
}

export function getColorScheme(): ColorScheme {
  return scheme;
}

/**
 * Valor que depende del tema y se define a nivel de módulo (estilos, mapas de colores).
 * Se calcula al primer uso con cada tema y se guarda en caché; el acceso no cambia
 * (`styles.row`, `tones[tone]`), por eso las pantallas no necesitan reescribirse.
 */
export function themed<T extends object>(factory: () => T): T {
  const cache = new Map<number, T>();
  const current = (): T => {
    let v = cache.get(version);
    if (!v) {
      v = factory();
      cache.set(version, v);
    }
    return v;
  };
  return new Proxy({} as T, {
    get: (_t, prop) => {
      const target = current();
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
    has: (_t, prop) => Reflect.has(current(), prop),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_t, prop) => {
      const d = Reflect.getOwnPropertyDescriptor(current(), prop);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

export function professionalPalette() {
  return scheme === 'dark' ? darkProfessionalColors : lightProfessionalColors;
}

export function proColor(key: string) {
  const list = professionalPalette();
  return list.find((c) => c.key === key) ?? list[0]!;
}

/** Paleta para avatares de clientes, derivada del nombre (estable). */
export function avatarColor(seed: string) {
  const list = professionalPalette();
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length]!;
}
