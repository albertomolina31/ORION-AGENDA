import type { ScheduleConflict } from '@orion/contracts';
import { appointmentStatusLabel } from '@orion/contracts';
import { router } from 'expo-router';
import { ChevronRight, TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';
import { fmt, localDate, noonOf } from '@/lib/format';
import { Card, colors, PressableScale, spacing, Text } from '@/ui';

/**
 * Citas afectadas por un cambio (horario, cierre o baja). Nunca se mueven ni cancelan
 * solas: cada una se abre para reprogramarla, reasignarla o cancelarla explícitamente.
 */
export function ConflictList({ conflicts, tz, title }: { conflicts: ScheduleConflict[]; tz: string; title: string }) {
  return (
    <Card tone="warning">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <TriangleAlert size={20} color="#C77A0A" />
        <Text variant="subheading" style={{ flex: 1 }}>
          {title}
        </Text>
      </View>
      <Text variant="caption" color={colors.accentInk} style={{ marginBottom: spacing.sm }}>
        Abre cada cita para reprogramarla, reasignarla o cancelarla. Nada se cambia en automático.
      </Text>
      <View style={{ gap: spacing.xs }}>
        {conflicts.map((c) => (
          <PressableScale
            key={c.appointmentId}
            onPress={() => router.push(`/cita/${c.appointmentId}`)}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: 10, backgroundColor: colors.surface }}
          >
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{c.customerName}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {fmt.weekdayShort(noonOf(localDate(c.startsAt, tz)), 'UTC')} · {fmt.range(c.startsAt, c.endsAt, tz)} · {c.serviceName} · {c.professionalName} ·{' '}
                {appointmentStatusLabel[c.status]}
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textSubtle} />
          </PressableScale>
        ))}
      </View>
    </Card>
  );
}
