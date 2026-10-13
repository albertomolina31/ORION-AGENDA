import type { AvailabilityResponse } from '@orion/contracts';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { addDays, capitalize, noonOf } from '@/lib/format';
import { colors, EmptyState, ErrorState, radius, SkeletonList, spacing, Text } from '@/ui';

export function DateStrip({ start, days = 14, value, onChange }: { start: string; days?: number; value: string; onChange: (d: string) => void }) {
  const fmtDay = new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'short' });
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {Array.from({ length: days }).map((_, i) => {
        const d = addDays(start, i);
        const active = d === value;
        return (
          <Pressable
            key={d}
            onPress={() => onChange(d)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.day, active && styles.dayActive]}
          >
            <Text variant="caption" color={active ? colors.textOnPrimary : colors.textMuted}>
              {capitalize(fmtDay.format(noonOf(d)).replace('.', ''))}
            </Text>
            <Text variant="heading" color={active ? colors.textOnPrimary : colors.text}>
              {Number(d.slice(8))}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Opciones de horario. Un slot mostrado no es garantía ni reserva. */
export function SlotGrid({
  data,
  loading,
  error,
  onRetry,
  value,
  onChange,
}: {
  data?: AvailabilityResponse;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  value: string | null;
  onChange: (startsAt: string) => void;
}) {
  if (loading) return <SkeletonList rows={2} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (!data) return null;
  if (data.slots.length === 0) {
    return <EmptyState title="Sin horarios disponibles" body={data.closedReason ?? 'Prueba con otro día o con otro profesional.'} withOri={false} />;
  }
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.grid}>
        {data.slots.map((s) => {
          const active = s.startsAt === value;
          return (
            <Pressable
              key={s.startsAt}
              onPress={() => onChange(s.startsAt)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${s.localTime}`}
              style={[styles.slot, active && styles.slotActive]}
            >
              <Text variant="bodyStrong" color={active ? colors.textOnPrimary : colors.primary}>
                {s.localTime}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text variant="micro" color={colors.textSubtle}>
        Horario de {data.timezone}. La disponibilidad se confirma al reservar.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  day: {
    width: 60,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: {
    minWidth: 82,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.surface,
  },
  slotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});
