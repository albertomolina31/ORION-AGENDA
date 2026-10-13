import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, haptic, radius, spacing, Text } from '@/ui';

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Selector de hora HH:mm con pasos (accesible y sin teclado). */
export function TimeStepper({
  value,
  onChange,
  step = 15,
  min = '00:00',
  max = '23:45',
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  step?: number;
  min?: string;
  max?: string;
  label?: string;
}) {
  const v = toMin(value);
  const set = (m: number) => {
    const clamped = Math.max(toMin(min), Math.min(toMin(max), m));
    if (clamped !== v) {
      haptic.select();
      onChange(toTime(clamped));
    }
  };
  return (
    <View style={styles.wrap} accessibilityRole="adjustable" accessibilityLabel={`${label ?? 'Hora'}: ${value}`}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => set(v + (e.nativeEvent.actionName === 'increment' ? step : -step))}
    >
      <Pressable onPress={() => set(v - step)} hitSlop={6} style={styles.btn} accessibilityLabel={`Restar ${step} minutos`}>
        <Minus size={16} color={colors.primary} />
      </Pressable>
      <Text variant="subheading" style={{ minWidth: 52, textAlign: 'center' }}>
        {value}
      </Text>
      <Pressable onPress={() => set(v + step)} hitSlop={6} style={styles.btn} accessibilityLabel={`Sumar ${step} minutos`}>
        <Plus size={16} color={colors.primary} />
      </Pressable>
    </View>
  );
}

/** Contador numérico genérico (minutos, cantidades). */
export function NumberStepper({ value, onChange, step = 5, min = 0, max = 600, suffix }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  const set = (n: number) => {
    const c = Math.max(min, Math.min(max, n));
    if (c !== value) {
      haptic.select();
      onChange(c);
    }
  };
  return (
    <View style={styles.wrap} accessibilityRole="adjustable" accessibilityLabel={`${value}${suffix ? ` ${suffix}` : ''}`}>
      <Pressable onPress={() => set(value - step)} hitSlop={6} style={styles.btn} accessibilityLabel={`Restar ${step}`}>
        <Minus size={16} color={colors.primary} />
      </Pressable>
      <Text variant="subheading" style={{ minWidth: 64, textAlign: 'center' }}>
        {value}
        {suffix ? ` ${suffix}` : ''}
      </Text>
      <Pressable onPress={() => set(value + step)} hitSlop={6} style={styles.btn} accessibilityLabel={`Sumar ${step}`}>
        <Plus size={16} color={colors.primary} />
      </Pressable>
    </View>
  );
}

export { toMin, toTime };

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, padding: 3, backgroundColor: colors.surface },
  btn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
