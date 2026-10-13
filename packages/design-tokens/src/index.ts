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
  /** Cara inferior del botón 3D (estilo Duolingo). */
  primaryDepth: '#3B22C2',
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
  /** Tonos de apoyo (antes escritos a mano en componentes). */
  warningInk: '#C77A0A',
  warningSurface: '#FCE7C2',
  successInk: '#17683A',
  dangerBorder: '#F2B8C0',
  disabledDepth: '#DCDAE3',
  pendingSurface: '#FFFBF3',
  highlightSurface: '#F4F1FF',
  accentButton: '#F8DFA9',
  chatBackground: '#EEF3EC',
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Modo oscuro (propuesta). Base azul noche profundo en lugar de negro, violeta más claro
 * para mantener contraste AA sobre superficies oscuras y dorado como acento. Mismas claves
 * que `colors`: los componentes no cambian.
 */
export const darkColors: Record<ColorToken, string> = {
  background: '#0D0F2B',
  surface: '#171A42',
  surfaceMuted: '#1D2050',
  surfaceAccent: '#262A66',
  text: '#F3F1FF',
  textMuted: '#B4B2D8',
  textSubtle: '#8D8BB4',
  textOnPrimary: '#FFFFFF',
  textOnNight: '#FFFFFF',
  textOnNightMuted: '#C9C6F2',
  primary: '#8E78FF',
  primaryPressed: '#7C64F7',
  primaryDepth: '#4C34C9',
  primarySoft: '#272463',
  primarySoftStrong: '#363089',
  primaryBorder: '#4A43A3',
  night: '#262A7C',
  nightDeep: '#1A1C5C',
  nightGlow: '#5B4BE0',
  accent: '#F2B657',
  accentSoft: '#3A2E1A',
  accentBorder: '#5C4520',
  accentInk: '#F6C877',
  success: '#45C97E',
  successSoft: '#143A2A',
  danger: '#FF6B7D',
  dangerSoft: '#3D1A26',
  neutral: '#A4A6C2',
  neutralSoft: '#262A50',
  border: '#2C3066',
  whatsapp: '#34C26F',
  whatsappSoft: '#123A28',
  overlay: 'rgba(0, 0, 0, 0.6)',
  warningInk: '#F6C877',
  warningSurface: '#3A2E1A',
  successInk: '#7FE0A6',
  dangerBorder: '#6B2A38',
  disabledDepth: '#1A1D45',
  pendingSurface: '#241F25',
  highlightSurface: '#262A66',
  accentButton: '#5C4520',
  chatBackground: '#132A22',
};

/** Colores asignados a profesionales (chip, avatar y barra lateral de la cita). */
export const professionalColors = [
  { key: 'lavender', soft: '#E8E2FD', strong: '#5B3DF5', bar: '#B9A8FB' },
  { key: 'mint', soft: '#D3F4E9', strong: '#157A5C', bar: '#8FE0C8' },
  { key: 'peach', soft: '#FFE2D2', strong: '#B44A17', bar: '#FBC29E' },
  { key: 'sky', soft: '#DCEBFF', strong: '#2A62BF', bar: '#9FC3F7' },
  { key: 'rose', soft: '#FBE0F1', strong: '#A12C74', bar: '#F2A8D6' },
] as const;

export type ProfessionalColorKey = (typeof professionalColors)[number]['key'];

/** Mismos colores de profesionales para modo oscuro: fondos tenues y tonos claros legibles. */
export const darkProfessionalColors: ReadonlyArray<{ key: ProfessionalColorKey; soft: string; strong: string; bar: string }> = [
  { key: 'lavender', soft: '#2C2766', strong: '#B9A8FB', bar: '#8E78FF' },
  { key: 'mint', soft: '#143A33', strong: '#8FE0C8', bar: '#45C9A2' },
  { key: 'peach', soft: '#3D2618', strong: '#FBC29E', bar: '#F0955E' },
  { key: 'sky', soft: '#172E52', strong: '#9FC3F7', bar: '#5C9BF0' },
  { key: 'rose', soft: '#3A1A33', strong: '#F2A8D6', bar: '#E46BB4' },
];

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

/**
 * Escala de app profesional (v2): títulos 22–30, texto base 15–16.
 * La v1 copiaba las proporciones de los mockups y se veía "con zoom".
 */
export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  subheading: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  captionStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
} as const;

/** Familia tipográfica por peso (Plus Jakarta Sans). En Android cada peso es una familia. */
export const fontFamilyByWeight = {
  '400': 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
} as const;

export type TypographyVariant = keyof typeof typography;

/** Área táctil mínima 44 × 44 (iOS HIG); los controles principales usan 48–52. */
export const touchTarget = 44;

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

export const tokens = { colors, darkColors, palette, professionalColors, darkProfessionalColors, spacing, radius, typography, fontFamilyByWeight, touchTarget, shadow };
export default tokens;
