import { router } from 'expo-router';
import { CalendarDays, CalendarX, ChevronRight, Clock, Plus, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { fmt, noonOf } from '@/lib/format';
import { useHome } from '@/lib/queries';
import { useBusiness, useSession } from '@/lib/session';
import { useRefreshOnFocus } from '@/lib/use-refresh-on-focus';
import { WhatsAppIcon } from '@/features/WhatsAppIcon';
import {
  AppHeader,
  Avatar,
  Badge,
  Card,
  colors,
  ErrorState,
  IconCircle,
  LinkButton,
  NightCard,
  Ori,
  radius,
  Screen,
  SectionHeader,
  shadow,
  SimulationBanner,
  SkeletonList,
  spacing,
  Sparkle,
  StatusBadge,
  Text,
} from '@/ui';

/** UI04 Inicio: resumen y atención inmediata. La operación detallada vive en Agenda. */
export default function Inicio() {
  const { me } = useSession();
  const m = useBusiness();
  const home = useHome();
  useRefreshOnFocus(home.refetch);
  const h = home.data;
  const canCreate = m.permissions.includes('appointments.manage_all') || m.permissions.includes('appointments.manage_own');

  return (
    <Screen onRefresh={() => home.refetch()} refreshing={home.isRefetching} header={null}>
      <AppHeader />
      <SimulationBanner />
      <View style={{ gap: 2 }}>
        <Text variant="display" style={{ fontSize: 40, lineHeight: 46 }} accessibilityRole="header">
          ¡Hola, {me?.user.name}!
        </Text>
        <Text variant="body" color={colors.textMuted} style={{ fontSize: 19 }}>
          {h ? fmt.longDay(noonOf(h.date), 'UTC') : ' '}
        </Text>
      </View>

      {home.isLoading ? <SkeletonList rows={3} /> : null}
      {home.error && !h ? <ErrorState error={home.error} onRetry={() => home.refetch()} /> : null}

      {h ? (
        <>
          <NightCard minHeight={200} style={{ paddingRight: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, gap: spacing.sm }}>
                <Text variant="title" color={colors.textOnNight} style={{ fontSize: 30, lineHeight: 34 }}>
                  Tu día,{'\n'}en un vistazo
                </Text>
                <Text variant="body" color={colors.textOnNightMuted} style={{ fontSize: 19 }}>
                  {h.scheduledCount === 0 ? 'Sin citas programadas' : `${h.scheduledCount} ${h.scheduledCount === 1 ? 'cita programada' : 'citas programadas'}`}
                </Text>
                <View style={styles.activePill}>
                  <View style={styles.greenDot} />
                  <Text variant="caption" color={colors.textOnNight}>
                    {h.activeProfessionals} {h.activeProfessionals === 1 ? 'profesional activo' : 'profesionales activos'}
                  </Text>
                </View>
              </View>
              <View style={{ marginRight: -8 }}>
                <View style={{ position: 'absolute', top: 6, left: 0 }}>
                  <Sparkle size={18} />
                </View>
                <Ori size={130} />
              </View>
            </View>
          </NightCard>

          <View style={styles.statsRow}>
            <StatCard
              tone="warning"
              icon={Clock}
              value={h.pendingApprovalCount}
              label="Por aprobar"
              onPress={() => router.push('/pendientes')}
            />
            <StatCard tone="primary" icon={CalendarDays} value={h.confirmedCount} label="Confirmadas" onPress={() => router.push('/agenda')} />
          </View>

          <View style={{ gap: spacing.md }}>
            <SectionHeader title="Próxima cita" actionLabel="Ver agenda" onAction={() => router.push('/agenda')} />
            {h.nextAppointment ? (
              <Card tone="accent" onPress={() => router.push(`/cita/${h.nextAppointment!.id}`)} accessibilityLabel={`Próxima cita: ${h.nextAppointment.customer.name}`}>
                <View style={{ gap: spacing.xs }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text variant="body" color={colors.textMuted} style={{ fontSize: 18 }}>
                      {fmt.range(h.nextAppointment.startsAt, h.nextAppointment.endsAt, h.timezone)}
                    </Text>
                    <StatusBadge status={h.nextAppointment.status} />
                  </View>
                  <Text variant="title">{h.nextAppointment.customer.name}</Text>
                  <Text variant="body" color={colors.textMuted} style={{ fontSize: 18 }}>
                    {h.nextAppointment.service.name}
                  </Text>
                  <View style={styles.nextFooter}>
                    <Avatar initials={h.nextAppointment.professional.initials} colorKey={h.nextAppointment.professional.colorKey} size={52} />
                    <Text variant="body" style={{ fontSize: 18 }}>
                      Con {h.nextAppointment.professional.name}
                    </Text>
                    <View style={styles.vr} />
                    <Text variant="body" style={{ fontSize: 18, flex: 1 }}>
                      {h.nextAppointment.service.durationMin} min
                    </Text>
                    <ChevronRight size={22} color={colors.text} />
                  </View>
                </View>
              </Card>
            ) : (
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Ori size={72} />
                  <View style={{ flex: 1 }}>
                    <Text variant="subheading">No quedan citas por hoy</Text>
                    <Text variant="caption" color={colors.textMuted}>
                      Revisa la agenda para los próximos días.
                    </Text>
                  </View>
                </View>
              </Card>
            )}
          </View>

          <View style={{ gap: spacing.md }}>
            <SectionHeader title="Accesos rápidos" />
            <View style={styles.quickRow}>
              {canCreate ? <QuickTile icon={Plus} label="+ Nueva cita" onPress={() => router.push('/cita/nueva')} /> : null}
              {m.permissions.includes('customers.manage') ? (
                <QuickTile icon={Users} label={`Nuevo ${m.vocabulary.customerSingular.toLowerCase()}`} onPress={() => router.push('/cliente/nuevo')} />
              ) : null}
              {m.permissions.includes('schedules.manage') ? (
                <QuickTile icon={CalendarX} label="Bloquear horario" onPress={() => router.push('/ajustes/horarios')} />
              ) : null}
            </View>
          </View>

          {h.whatsapp ? (
            <Card onPress={m.permissions.includes('business.configure') ? () => router.push('/negocio') : undefined}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
                <View style={styles.waCircle}>
                  <WhatsAppIcon size={34} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="subheading">{h.whatsapp.status === 'CONNECTED' ? 'WhatsApp conectado' : 'WhatsApp sin conectar'}</Text>
                  <Text variant="caption" color={colors.textMuted}>
                    {h.whatsapp.status === 'CONNECTED' ? 'Las reservas llegan a tu agenda' : 'La agenda manual sigue operativa'}
                  </Text>
                </View>
                {h.whatsapp.status !== 'CONNECTED' ? <Badge label={h.whatsapp.statusLabel} tone="warning" /> : null}
                <ChevronRight size={22} color={colors.text} />
              </View>
            </Card>
          ) : null}

          <Text variant="micro" color={colors.textSubtle} align="center">
            Actualizado a las {fmt.time(h.generatedAt, h.timezone)} · hora de {h.timezone}
          </Text>
          {home.error ? <LinkButton label="Datos desactualizados · Reintentar" onPress={() => home.refetch()} /> : null}
        </>
      ) : null}
    </Screen>
  );
}

function StatCard({
  icon,
  value,
  label,
  onPress,
  tone,
}: {
  icon: typeof Clock;
  value: number;
  label: string;
  onPress: () => void;
  tone: 'warning' | 'primary';
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      style={({ pressed }) => [
        styles.stat,
        tone === 'warning' ? { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder } : null,
        pressed && { opacity: 0.85 },
      ]}
    >
      <IconCircle icon={icon} tone={tone} size={48} />
      <View style={{ flex: 1 }}>
        <Text variant="display" style={{ fontSize: 32, lineHeight: 36 }}>
          {value}
        </Text>
        <Text variant="body" numberOfLines={2}>
          {label}
        </Text>
      </View>
      <ChevronRight size={20} color={colors.text} />
    </Pressable>
  );
}

function QuickTile({ icon: Icon, label, onPress }: { icon: typeof Plus; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.quick, pressed && { opacity: 0.85 }]}>
      <View style={styles.quickIcon}>
        <Icon size={30} color={colors.primary} />
      </View>
      <Text variant="bodyStrong" align="center">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: spacing.xs,
  },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#8FE3A0' },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  nextFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.primarySoftStrong,
  },
  vr: { width: 1, height: 28, backgroundColor: colors.primarySoftStrong },
  quickRow: { flexDirection: 'row', gap: spacing.md },
  quick: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  quickIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  waCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.whatsappSoft, alignItems: 'center', justifyContent: 'center' },
});
