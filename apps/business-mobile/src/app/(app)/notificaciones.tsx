import type { NotificationItem, NotificationType } from '@orion/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CalendarClock, CalendarPlus, CalendarX, CheckCheck, Clock, Inbox } from 'lucide-react-native';
import { View } from 'react-native';
import { endpoints } from '@/lib/endpoints';
import { fmt } from '@/lib/format';
import { useNotifications } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { useRefreshOnFocus } from '@/lib/use-refresh-on-focus';
import { Appear, colors, EmptyState, ErrorState, IconCircle, LinkButton, Note, PressableScale, radius, Screen, SkeletonList, spacing, StackHeader, Text } from '@/ui';

const iconFor: Record<NotificationType, { icon: typeof Clock; tone: 'warning' | 'primary' | 'neutral' | 'success' }> = {
  REQUEST_RECEIVED: { icon: Inbox, tone: 'warning' },
  REQUEST_EXPIRED: { icon: Clock, tone: 'neutral' },
  APPOINTMENT_CANCELLED: { icon: CalendarX, tone: 'neutral' },
  APPOINTMENT_RESCHEDULED: { icon: CalendarClock, tone: 'primary' },
  APPOINTMENT_BOOKED: { icon: CalendarPlus, tone: 'success' },
};

/**
 * UI18 Notificaciones: avisos operativos reales (solicitudes, vencimientos, cancelaciones).
 * Abrir un aviso lleva al detalle vigente de la cita, con sus acciones actuales.
 */
export default function Notifications() {
  const m = useBusiness();
  const q = useNotifications();
  const qc = useQueryClient();
  useRefreshOnFocus(q.refetch);

  const mark = async (body: { ids?: string[]; all?: boolean }) => {
    const res = await endpoints.markNotifications(m.businessId, body);
    qc.setQueryData(['notifications', m.businessId], res);
  };

  const open = (n: NotificationItem) => {
    if (!n.read) void mark({ ids: [n.id] });
    if (n.appointmentId) router.push(`/cita/${n.appointmentId}`);
  };

  const unread = q.data?.items.filter((i) => !i.read) ?? [];
  const read = q.data?.items.filter((i) => i.read) ?? [];

  const row = (n: NotificationItem, i: number) => {
    const { icon, tone } = iconFor[n.type];
    return (
      <Appear key={n.id} index={i}>
        <PressableScale
          onPress={() => open(n)}
          accessibilityRole="button"
          accessibilityLabel={`${n.read ? '' : 'No leído. '}${n.title}. ${n.body}`}
          scaleTo={0.98}
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: n.read ? colors.surface : colors.surfaceMuted,
            borderWidth: 1,
            borderColor: n.read ? colors.border : colors.primarySoftStrong,
          }}
        >
          <IconCircle icon={icon} tone={tone} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {n.title}
              </Text>
              {!n.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} /> : null}
            </View>
            <Text variant="caption" color={colors.textMuted}>
              {n.body}
            </Text>
            <Text variant="micro" color={colors.textSubtle}>
              {fmt.shortDay(n.at, m.timezone)} · {fmt.time(n.at, m.timezone)}
            </Text>
          </View>
        </PressableScale>
      </Appear>
    );
  };

  return (
    <Screen
      header={
        <StackHeader
          title="Notificaciones"
          subtitle={m.businessName}
          right={unread.length ? <LinkButton label="Leer todo" chevron={false} onPress={() => void mark({ all: true })} /> : undefined}
        />
      }
      onRefresh={() => q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isLoading ? <SkeletonList rows={4} /> : null}
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}
      {q.data && q.data.items.length === 0 ? (
        <EmptyState pose="sleep" title="Sin avisos por ahora" body="Aquí verás solicitudes nuevas, vencimientos y cancelaciones. Denegar notificaciones push no impide usar la agenda." />
      ) : null}
      {unread.length ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Text variant="subheading">Nuevas</Text>
            <Text variant="captionStrong" color={colors.primary}>
              {unread.length}
            </Text>
          </View>
          {unread.map(row)}
        </View>
      ) : q.data && q.data.items.length ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <CheckCheck size={18} color={colors.success} />
          <Text variant="caption" color={colors.textMuted}>
            Estás al día.
          </Text>
        </View>
      ) : null}
      {read.length ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="subheading" color={colors.textMuted}>
            Anteriores
          </Text>
          {read.map((n, i) => row(n, i + unread.length))}
        </View>
      ) : null}
      <Note body="Últimos 7 días. Por privacidad, las notificaciones push en pantalla bloqueada no mostrarán nombres de clientes." />
    </Screen>
  );
}
