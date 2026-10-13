import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from './theme';

type Tone = 'default' | 'accent' | 'warning' | 'muted' | 'night';

const toneStyle: Record<Tone, ViewStyle> = {
  default: { backgroundColor: colors.surface, borderColor: colors.border },
  accent: { backgroundColor: colors.surfaceMuted, borderColor: colors.primarySoftStrong },
  warning: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  muted: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  night: { backgroundColor: colors.night, borderColor: colors.night },
};

export function Card({
  children,
  tone = 'default',
  onPress,
  style,
  padded = true,
  accessibilityLabel,
}: {
  children: ReactNode;
  tone?: Tone;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  accessibilityLabel?: string;
}) {
  const base = [styles.card, toneStyle[tone], padded && styles.padded, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [...base, pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, ...shadow.card },
  padded: { padding: spacing.lg },
});
