import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing, touchTarget } from './theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  trailingIcon: Trailing,
  loading,
  disabled,
  compact,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: LucideIcon;
  trailingIcon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  accessibilityHint?: string;
}) {
  const v = variants[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: isDisabled && variant === 'primary' ? colors.neutralSoft : v.bg, borderColor: v.border },
        pressed && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.row}>
          {Icon ? <Icon size={20} color={isDisabled && variant === 'primary' ? colors.textSubtle : v.fg} /> : null}
          <Text variant="subheading" color={isDisabled && variant === 'primary' ? colors.textSubtle : v.fg} style={styles.label}>
            {label}
          </Text>
          {Trailing ? <Trailing size={20} color={isDisabled && variant === 'primary' ? colors.textSubtle : v.fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const variants: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.textOnPrimary, border: 'transparent' },
  secondary: { bg: colors.primarySoft, fg: colors.primary, border: 'transparent' },
  outline: { bg: colors.surface, fg: colors.primary, border: colors.primary },
  destructive: { bg: colors.surface, fg: colors.danger, border: colors.danger },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { minHeight: touchTarget, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { textAlign: 'center' },
});
