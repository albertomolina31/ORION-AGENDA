import { router } from 'expo-router';
import { ChevronRight, Clock } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { addDays, fmt, localDate, noonOf } from '@/lib/format';
import { useAgenda, useHome } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { useRefreshOnFocus } from '@/lib/use-refresh-on-focus';
import { colors, EmptyState, ErrorState, IconCircle, radius, Screen, SkeletonList, spacing, StackHeader, Text } from '@/ui';

/** UI09 Pendientes: solicitudes con vencimiento explícito. Aprobar/rechazar desde el detalle. */
export default function Pending() {
  const m = useBusiness();
  const home = useHome();
  const today = home.data?.date;
  const q = useAgenda({ from: today ?? '', to: today ? addDays(today, 30) : '', status: ['PENDING_APPROVAL'] }, !!today);
  useRefreshOnFocus(q.refetch);
  const list = (q.data?.appointments ?? []).filter((a) => a.status === 'PENDING_APPROVAL');

  return (
    <Screen header={<StackHeader title="Por aprobar" subtitle={m.businessName} />} onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading || !today ? <SkeletonList rows={3} /> : null}
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}
      {q.data && list.length === 0 ? <EmptyState title="Todo al día" body="No hay solicitudes pendientes de aprobación." /> : null}
      {list.map((a) => (
        <Pressable key={a.id} onPress={() => router.push(`/cita/${a.id}`)} accessibilityRole="button" style={styles.card}>
          <IconCircle icon={Clock} tone="warning" size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="subheading">{a.customer.name}</Text>
            <Text variant="caption" color={colors.textMuted}>
              {fmt.weekdayShort(noonOf(localDate(a.startsAt, a.timezone)), 'UTC')} · {fmt.time(a.startsAt, a.timezone)} · {a.service.name} · {a.professional.name}
            </Text>
            {a.expiresAt ? (
              <Text variant="captionStrong" color={colors.accentInk}>
                Vence a las {fmt.time(a.expiresAt, a.timezone)}
              </Text>
            ) : null}
          </View>
          <ChevronRight size={22} color={colors.text} />
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
});
