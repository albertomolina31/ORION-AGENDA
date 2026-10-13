import type { HomeSummary } from '@orion/contracts';
import { router } from 'expo-router';
import { CalendarCheck, CalendarDays, CalendarX, ChevronRight, Clock, Plus, UserPlus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { WhatsAppIcon } from '@/features/WhatsAppIcon';
import { fmt, noonOf } from '@/lib/format';
import { useHome } from '@/lib/queries';
import { useBusiness, useSession } from '@/lib/session';
import { useRefreshOnFocus } from '@/lib/use-refresh-on-focus';
import {
  AnimatedNumber,
  Appear,
  Avatar,
  Badge,
  Card,
  colors,
  ErrorState,
  IconCircle,
  NightCard,
  Ori,
  type OriPose,
  PressableScale,
  ProgressRing,
  radius,
  Screen,
  SectionHeader,
  shadow,
  SkeletonList,
  spacing,
  StatusBadge,
  Text,
} from '@/ui';

/** Mensaje contextual de Ori: prioriza lo que requiere atención. */
function oriMessage(h: HomeSummary): { pose: OriPose; text: string } {
  if (h.pendingApprovalCount > 0)
    return { pose: 'point', text: `${h.pendingApprovalCount} ${h.pendingApprovalCount === 1 ? 'solicitud espera' : 'solicitudes esperan'} tu respuesta.` };
  if (h.nextAppointment) return { pose: 'calendar', text: `Tu próxima cita es a las ${fmt.time(h.nextAppointment.startsAt, h.timezone)}.` };
  if (h.scheduledCount + h.completedCount > 0 && h.completedCount >= h.scheduledCount) return { pose: 'celebrate', text: '¡Día completo! Buen trabajo.' };
  return { pose: 'sleep', text: 'Día tranquilo: no hay citas pendientes.' };
}

/** UI04 Inicio: resumen y atención inmediata. La operación detallada vive en Agenda. */
export default function Inicio() {
  const { me } = useSession();
  const m = useBusiness();
  const home = useHome();
  useRefreshOnFocus(home.refetch);
  const h = home.data;
  const canCreate = m.permissions.includes('appointments.manage_all') || m.permissions.includes('appointments.manage_own');
  const ori = h ? oriMessage(h) : null;
  const dayTotal = h ? h.scheduledCount + h.completedCount : 0;

  return (
    <Screen tabTitle="Inicio" onRefresh={() => home.refetch()} refreshing={home.isRefetching}>
      <Appear>
        <Text variant="caption" color={colors.textMuted}>
          {h ? fmt.longDay(noonOf(h.date), 'UTC') : ' '}
        </Text>
        <Text variant="display" accessibilityRole="header">
          ¡Hola, {me?.user.name}!
        </Text>
      </Appear>

      {home.isLoading ? <SkeletonList rows={3} /> : null}
      {home.error && !h ? <ErrorState error={home.error} onRetry={() => home.refetch()} /> : null}

      {h && ori ? (
        <>
          <Appear index={1}>
            <NightCard style={{ paddingRight: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <ProgressRing value={h.completedCount} total={dayTotal} onDark label="citas atendidas hoy" />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="heading" color={colors.textOnNight}>
                    Tu día, en un vistazo
                  </Text>
                  <Text variant="caption" color={colors.textOnNightMuted}>
                    {h.completedCount} {h.completedCount === 1 ? 'atendida' : 'atendidas'} · {h.scheduledCount} por atender
                  </Text>
                  <View style={styles.activePill}>
                    <View style={styles.greenDot} />
                    <Text variant="micro" color={colors.textOnNight}>
                      {h.activeProfessionals} {h.activeProfessionals === 1 ? 'profesional activo' : 'profesionales activos'}
                    </Text>
                  </View>
                </View>
                <Ori pose="wave" size={92} />
              </View>
              <View style={styles.oriBubble}>
                <Text variant="captionStrong" color={colors.textOnNight}>
                  {ori.text}
                </Text>
              </View>
            </NightCard>
          </Appear>

          <Appear index={2} style={styles.statsRow}>
            <Stat tone="warning" icon={Clock} value={h.pendingApprovalCount} label="Por aprobar" onPress={() => router.push('/pendientes')} />
            <Stat tone="primary" icon={CalendarDays} value={h.confirmedCount} label="Confirmadas" onPress={() => router.push('/agenda')} />
            <Stat tone="success" icon={CalendarCheck} value={h.completedCount} label="Atendidas" onPress={() => router.push('/agenda')} />
          </Appear>

          <Appear index={3} style={{ gap: spacing.sm }}>
            <SectionHeader title="Próxima cita" actionLabel="Ver agenda" onAction={() => router.push('/agenda')} />
            {h.nextAppointment ? (
              <Card tone="accent" onPress={() => router.push(`/cita/${h.nextAppointment!.id}`)} accessibilityLabel={`Próxima cita: ${h.nextAppointment.customer.name}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={styles.timeBox}>
                    <Text variant="heading" color={colors.primary}>
                      {fmt.time(h.nextAppointment.startsAt, h.timezone)}
                    </Text>
                    <Text variant="micro" color={colors.textMuted}>
                      {h.nextAppointment.service.durationMin} min
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="subheading" numberOfLines={1}>
                      {h.nextAppointment.customer.name}
                    </Text>
                    <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                      {h.nextAppointment.service.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 }}>
                      <Avatar initials={h.nextAppointment.professional.initials} colorKey={h.nextAppointment.professional.colorKey} size={22} />
                      <Text variant="caption">Con {h.nextAppointment.professional.name}</Text>
                    </View>
                  </View>
                  <StatusBadge status={h.nextAppointment.status} />
                </View>
              </Card>
            ) : (
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Ori pose="sleep" size={60} />
                  <View style={{ flex: 1 }}>
                    <Text variant="subheading">No quedan citas por hoy</Text>
                    <Text variant="caption" color={colors.textMuted}>
                      Revisa la agenda para los próximos días.
                    </Text>
                  </View>
                </View>
              </Card>
            )}
          </Appear>

          <Appear index={4} style={{ gap: spacing.sm }}>
            <SectionHeader title="Accesos rápidos" />
            <View style={styles.quickRow}>
              {canCreate ? <Quick icon={Plus} label="Nueva cita" primary onPress={() => router.push('/cita/nueva')} /> : null}
              {m.permissions.includes('customers.manage') ? (
                <Quick icon={UserPlus} label={`Nuevo ${m.vocabulary.customerSingular.toLowerCase()}`} onPress={() => router.push('/cliente/nuevo')} />
              ) : null}
              {m.permissions.includes('schedules.manage') ? <Quick icon={CalendarX} label="Bloquear horario" onPress={() => router.push('/ajustes/horarios')} /> : null}
            </View>
          </Appear>

          {h.whatsapp ? (
            <Appear index={5}>
              <Card onPress={m.permissions.includes('business.configure') ? () => router.push('/negocio') : undefined}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={styles.waCircle}>
                    <WhatsAppIcon size={24} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{h.whatsapp.status === 'CONNECTED' ? 'WhatsApp conectado' : 'WhatsApp sin conectar'}</Text>
                    <Text variant="caption" color={colors.textMuted}>
                      {h.whatsapp.status === 'CONNECTED' ? 'Las reservas llegan a tu agenda' : 'La agenda manual sigue operativa'}
                    </Text>
                  </View>
                  {h.whatsapp.status !== 'CONNECTED' ? <Badge label={h.whatsapp.statusLabel} tone="warning" /> : null}
                  <ChevronRight size={18} color={colors.textSubtle} />
                </View>
              </Card>
            </Appear>
          ) : null}

          <Text variant="micro" color={colors.textSubtle} align="center">
            Actualizado {fmt.time(h.generatedAt, h.timezone)} · hora de {h.timezone}
            {home.error ? ' · no se pudo actualizar' : ''}
          </Text>
        </>
      ) : null}
    </Screen>
  );
}

function Stat({ icon, value, label, onPress, tone }: { icon: typeof Clock; value: number; label: string; onPress: () => void; tone: 'warning' | 'primary' | 'success' }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      style={[styles.stat, tone === 'warning' && value > 0 ? { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder } : null]}
    >
      <IconCircle icon={icon} tone={tone} size={34} />
      <AnimatedNumber value={value} variant="title" />
      <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

function Quick({ icon: Icon, label, onPress, primary }: { icon: typeof Plus; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" style={[styles.quick, primary && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      <Icon size={22} color={primary ? colors.textOnPrimary : colors.primary} strokeWidth={2.3} />
      <Text variant="captionStrong" align="center" color={primary ? colors.textOnPrimary : colors.text} numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 2,
  },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#8FE3A0' },
  oriBubble: {
    marginTop: spacing.md,
    marginRight: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  timeBox: { width: 64, height: 56, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quick: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  waCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.whatsappSoft, alignItems: 'center', justifyContent: 'center' },
});
