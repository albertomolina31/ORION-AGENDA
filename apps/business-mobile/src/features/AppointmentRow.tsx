import type { Appointment } from '@orion/contracts';
import { router } from 'expo-router';
import { Lock, Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { fmt } from '@/lib/format';
import { Avatar, colors, PressableScale, proColor, radius, shadow, spacing, StatusBadge, Text } from '@/ui';

/**
 * Fila de agenda compacta: hora, cliente, servicio, profesional y estado. Tocar abre
 * el detalle; no hay gestos ocultos que cambien el estado.
 */
export function AppointmentRow({ appt }: { appt: Appointment }) {
  const c = proColor(appt.professional.colorKey);
  const tz = appt.timezone;
  const inactive = appt.status !== 'CONFIRMED' && appt.status !== 'PENDING_APPROVAL';
  return (
    <View style={styles.row}>
      <View style={styles.timeCol}>
        <Text variant="captionStrong">{fmt.time(appt.startsAt, tz)}</Text>
        <Text variant="micro" color={colors.textSubtle}>
          {fmt.time(appt.endsAt, tz)}
        </Text>
      </View>
      <PressableScale
        onPress={() => router.push(`/cita/${appt.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${fmt.time(appt.startsAt, tz)}, ${appt.customer.name}, ${appt.service.name} con ${appt.professional.name}`}
        scaleTo={0.98}
        style={[styles.card, { borderLeftColor: c.bar }, inactive && { opacity: 0.55 }, appt.status === 'PENDING_APPROVAL' && styles.pending]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.titleRow}>
            <Text variant="subheading" numberOfLines={1} style={{ flex: 1 }}>
              {appt.customer.name}
            </Text>
            <StatusBadge status={appt.status} />
          </View>
          <View style={styles.meta}>
            <Avatar initials={appt.professional.initials} colorKey={appt.professional.colorKey} size={20} />
            <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
              {appt.professional.name} · {appt.service.name} · {appt.service.durationMin} min
            </Text>
          </View>
        </View>
      </PressableScale>
    </View>
  );
}

/** Bloqueo manual en la línea de tiempo (no es una cita). */
export function BlockRow({ block, tz }: { block: { startsAt: string; endsAt: string; professionalName: string; reason: string | null }; tz: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.timeCol}>
        <Text variant="captionStrong" color={colors.textMuted}>
          {fmt.time(block.startsAt, tz)}
        </Text>
        <Text variant="micro" color={colors.textSubtle}>
          {fmt.time(block.endsAt, tz)}
        </Text>
      </View>
      <View style={styles.block} accessibilityLabel={`Bloqueado de ${fmt.time(block.startsAt, tz)} a ${fmt.time(block.endsAt, tz)}, ${block.professionalName}`}>
        <Lock size={14} color={colors.textMuted} />
        <Text variant="caption" color={colors.textMuted} style={{ flex: 1 }} numberOfLines={1}>
          Bloqueado · {block.professionalName}
          {block.reason ? ` · ${block.reason}` : ''}
        </Text>
      </View>
    </View>
  );
}

/** Marca de "ahora" en la línea de tiempo del día. */
export function NowMarker({ time }: { time: string }) {
  return (
    <View style={styles.nowRow} accessibilityLabel={`Ahora, ${time}`}>
      <Text variant="micro" color={colors.danger} style={{ width: 48 }}>
        {time}
      </Text>
      <View style={styles.nowDot} />
      <View style={styles.nowLine} />
    </View>
  );
}

/** Hueco sin citas entre dos citas de un profesional. No implica disponibilidad: puede incluir descansos; "Agendar" consulta el motor real. */
export function FreeSlot({ from, to, onPress }: { from: string; to: string; onPress: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.timeCol} />
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Sin citas de ${from} a ${to}. Agendar`} style={styles.free} scaleTo={0.98}>
        <Text variant="caption" color={colors.textMuted} style={{ flex: 1 }}>
          Sin citas {from} – {to}
        </Text>
        <Plus size={14} color={colors.primary} />
        <Text variant="captionStrong" color={colors.primary}>
          Agendar
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  timeCol: { width: 48, paddingTop: spacing.sm + 2 },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md + 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    ...shadow.card,
  },
  pending: { backgroundColor: '#FFFBF3', borderColor: colors.accentBorder },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: -2 },
  nowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginLeft: -4 },
  nowLine: { flex: 1, height: 2, backgroundColor: colors.danger, opacity: 0.6, marginLeft: -spacing.sm },
  block: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md + 2,
    backgroundColor: colors.neutralSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  free: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md + 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primaryBorder,
  },
});
