import { colors, professionalColors, radius, shadow, spacing, touchTarget, typography } from '@orion/design-tokens';

export { colors, radius, shadow, spacing, touchTarget, typography };

export function proColor(key: string) {
  return professionalColors.find((c) => c.key === key) ?? professionalColors[0];
}

/** Paleta para avatares de clientes, derivada del nombre (estable). */
export function avatarColor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return professionalColors[h % professionalColors.length]!;
}
