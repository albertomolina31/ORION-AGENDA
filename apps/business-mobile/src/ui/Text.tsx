import { fontFamilyByWeight, type TypographyVariant } from '@orion/design-tokens';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, typography } from './theme';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}

/** Texto con Plus Jakarta Sans; escala con las preferencias del teléfono (tope 1.5×). */
export function Text({ variant = 'body', color = colors.text, align, style, ...rest }: AppTextProps) {
  const t = typography[variant];
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={1.5}
      style={[
        { fontSize: t.fontSize, lineHeight: t.lineHeight, fontFamily: fontFamilyByWeight[t.fontWeight], color, textAlign: align },
        style,
      ]}
    />
  );
}
