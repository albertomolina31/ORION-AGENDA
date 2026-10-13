import type { Appointment } from '@orion/contracts';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { fmt } from '@/lib/format';
import { Avatar, colors, proColor, radius, shadow, spacing, StatusBadge, Text } from '@/ui';

/**
 * Fila de agenda: hora, cliente, servicio, profesional y estado. Tocar abre el detalle;
 * no hay gestos ocultos que cambien el estado.
 */
export function AppointmentRow({ appt, showTimeline = true }: { appt: Appointment; showTimeline?: boolean }) {
  const c = proColor(appt.professional.colorKey);
  const tz = appt.timezone;
  const inactive = appt.status !== 'CONFIRMED' && appt.status !== 'PENDING_APPROVAL';
  return (
    <View style={styles.row}>
      {showTimeline ? (
        <View style={styles.timeCol}>
          <Text variant="body" color={colors.textMuted}>
            {fmt.time(appt.startsAt, tz)}
          </Text>
          <View style={[styles.dot, { backgroundColor: c.bar }]} />
        </View>
      ) : null}
      <Pressable
        onPress={() => router.push(`/cita/${appt.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${fmt.time(appt.startsAt, tz)}, ${appt.customer.name}, ${appt.service.name} con ${appt.professional.name}`}
        style={({ pressed }) => [styles.card, { borderLeftColor: c.bar }, inactive && { opacity: 0.6 }, pressed && { opacity: 0.8 }]}
      >
        <Avatar initials={appt.professional.initials} colorKey={appt.professional.colorKey} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.titleRow}>
            <Text variant="subheading" numberOfLines={1} style={{ flex: 1 }}>
              {appt.customer.name}
            </Text>
            <StatusBadge status={appt.status} />
          </View>
          <Text variant="body" color={colors.textMuted} numberOfLines={1}>
            {appt.service.name} · {appt.service.durationMin} min
          </Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            Con {appt.professional.name}  |  {fmt.range(appt.startsAt, appt.endsAt, tz)}
          </Text>
        </View>
        <ChevronRight size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  timeCol: { width: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 2 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingLeft: spacing.md + 2,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
    ...shadow.card,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
