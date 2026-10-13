/**
 * Tokens de diseño de Orion Business.
 *
 * Derivados de los mockups aprobados como dirección visual (sección 26 del plan):
 * marfil, azul noche, violeta/lavanda y dorado. Siguen siendo PROPUESTA: validar
 * contraste en dispositivo antes de cerrar componentes. El dorado es decoración;
 * no usarlo como color de texto pequeño sobre blanco.
 */

export const palette = {
  ivory: '#FBF8F4',
  white: '#FFFFFF',
  night: '#1C1E57',
  nightDeep: '#12143F',
  nightGlow: '#4B3BC4',
  ink: '#11163D',
  inkMuted: '#555A78',
  inkSubtle: '#7C809A',
  violet: '#5B3DF5',
  violetPressed: '#4A2DE0',
  lavender: '#EEE9FE',
  lavenderStrong: '#DCD3FD',
  lavenderBorder: '#CFC4FC',
  gold: '#E9A23B',
  goldSoft: '#FDF3E2',
  goldBorder: '#F4DDB2',
  goldInk: '#8A5300',
  green: '#1E8E4E',
  greenSoft: '#DDF5E6',
  red: '#C6283C',
  redSoft: '#FDE7EA',
  gray: '#5B5F7A',
  graySoft: '#EFEEF2',
  border: '#E7E3EE',
  whatsapp: '#1FA855',
  whatsappSoft: '#DFF6E8',
} as const;

export const colors = {
  background: palette.ivory,
  surface: palette.white,
  surfaceMuted: '#F7F4FC',
  surfaceAccent: palette.lavender,
  text: palette.ink,
  textMuted: palette.inkMuted,
  textSubtle: palette.inkSubtle,
  textOnPrimary: palette.white,
  textOnNight: palette.white,
  textOnNightMuted: '#C9C6F2',
  primary: palette.violet,
  primaryPressed: palette.violetPressed,
  primarySoft: palette.lavender,
  primarySoftStrong: palette.lavenderStrong,
  primaryBorder: palette.lavenderBorder,
  night: palette.night,
  nightDeep: palette.nightDeep,
  nightGlow: palette.nightGlow,
  accent: palette.gold,
  accentSoft: palette.goldSoft,
  accentBorder: palette.goldBorder,
  accentInk: palette.goldInk,
  success: palette.green,
  successSoft: palette.greenSoft,
  danger: palette.red,
  dangerSoft: palette.redSoft,
  neutral: palette.gray,
  neutralSoft: palette.graySoft,
  border: palette.border,
  whatsapp: palette.whatsapp,
  whatsappSoft: palette.whatsappSoft,
  overlay: 'rgba(17, 22, 61, 0.45)',
} as const;

/** Colores asignados a profesionales (chip, avatar y barra lateral de la cita). */
export const professionalColors = [
  { key: 'lavender', soft: '#E8E2FD', strong: '#5B3DF5', bar: '#B9A8FB' },
  { key: 'mint', soft: '#D3F4E9', strong: '#157A5C', bar: '#8FE0C8' },
  { key: 'peach', soft: '#FFE2D2', strong: '#B44A17', bar: '#FBC29E' },
  { key: 'sky', soft: '#DCEBFF', strong: '#2A62BF', bar: '#9FC3F7' },
  { key: 'rose', soft: '#FBE0F1', strong: '#A12C74', bar: '#F2A8D6' },
] as const;

export type ProfessionalColorKey = (typeof professionalColors)[number]['key'];

/** Escala de espaciado 4/8/12/16/24/32 (+ extremos de layout). */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** Texto base 16; títulos 24–28 (pantallas principales usan display). */
export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800' },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  subheading: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 14, lineHeight: 19, fontWeight: '400' },
  captionStrong: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  micro: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Área táctil objetivo 48 × 48 unidades lógicas. */
export const touchTarget = 48;

export const shadow = {
  card: {
    shadowColor: '#2A1F7A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#2A1F7A',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

export const tokens = { colors, palette, professionalColors, spacing, radius, typography, touchTarget, shadow };
export default tokens;
