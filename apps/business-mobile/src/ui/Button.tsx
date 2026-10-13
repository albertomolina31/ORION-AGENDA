import { CloudOff, type LucideIcon } from 'lucide-react-native';
import { useNetwork } from '@/lib/network';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { haptic } from './motion';
import { Text } from './Text';
import { colors, radius, spacing } from './theme';
import { themed } from './theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';

const DEPTH = 4;

/**
 * Botón con profundidad (inspirado en Duolingo): una cara inferior sólida que se
 * "hunde" al presionar. Vibración ligera en dispositivos.
 */
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
  requiresOnline,
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
  /** Acción transaccional: se desactiva sin conexión (nunca se encola ni se simula éxito). */
  requiresOnline?: boolean;
}) {
  const { online } = useNetwork();
  const offlineBlocked = !!requiresOnline && !online;
  const isDisabled = !!(disabled || loading || offlineBlocked);
  if (offlineBlocked) {
    label = 'Sin conexión';
    Icon = CloudOff;
    Trailing = undefined;
  }
  const v = isDisabled && variant === 'primary' ? disabledStyle : variants[variant];
  const flat = variant === 'ghost';
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      accessibilityHint={accessibilityHint}
      style={[styles.depth, { backgroundColor: flat ? 'transparent' : v.depth, paddingBottom: flat ? 0 : DEPTH }]}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.face,
            compact && styles.compact,
            { backgroundColor: v.bg, borderColor: v.border },
            pressed && !flat && { transform: [{ translateY: DEPTH - 1 }] },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={v.fg} />
          ) : (
            <View style={styles.row}>
              {Icon ? <Icon size={19} color={v.fg} strokeWidth={2.4} /> : null}
              <Text variant="subheading" color={v.fg}>
                {label}
              </Text>
              {Trailing ? <Trailing size={19} color={v.fg} strokeWidth={2.4} /> : null}
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const variants: Record<Variant, { bg: string; fg: string; border: string; depth: string }> = themed(() => ({
  primary: { bg: colors.primary, fg: colors.textOnPrimary, border: colors.primary, depth: colors.primaryDepth },
  secondary: { bg: colors.primarySoft, fg: colors.primary, border: colors.primarySoft, depth: colors.primarySoftStrong },
  outline: { bg: colors.surface, fg: colors.primary, border: colors.primaryBorder, depth: colors.primaryBorder },
  destructive: { bg: colors.surface, fg: colors.danger, border: colors.dangerBorder, depth: colors.dangerBorder },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent', depth: 'transparent' },
}));
const disabledStyle = themed(() => ({ bg: colors.neutralSoft, fg: colors.textSubtle, border: colors.neutralSoft, depth: colors.disabledDepth }));

const styles = StyleSheet.create({
  depth: { borderRadius: radius.lg },
  face: {
    minHeight: 50,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { minHeight: 42, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
