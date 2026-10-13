import type { TypographyVariant } from '@orion/design-tokens';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, typography } from './theme';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}

/** Texto que escala con las preferencias del teléfono (no se desactiva allowFontScaling). */
export function Text({ variant = 'body', color = colors.text, align, style, ...rest }: AppTextProps) {
  const t = typography[variant];
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={1.6}
      style={[{ fontSize: t.fontSize, lineHeight: t.lineHeight, fontWeight: t.fontWeight, color, textAlign: align }, style]}
    />
  );
}
