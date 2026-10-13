import type { AgendaResponse, Appointment } from '@orion/contracts';
import { router } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppointmentRow, BlockRow, FreeSlot, NowMarker } from '@/features/AppointmentRow';
import { addDays, fmt, localDate, noonOf, startOfWeek } from '@/lib/format';
import { useAgenda, useHome, useProfessionals } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { useRefreshOnFocus } from '@/lib/use-refresh-on-focus';
import Animated, { LinearTransition, ReduceMotion } from 'react-native-reanimated';
import {
  Appear,
  Avatar,
  Button,
  Chip,
  colors,
  EmptyState,
  ErrorState,
  IconCircle,
  NightCard,
  PageTitle,
  radius,
  Screen,
  SegmentedControl,
  SkeletonList,
  spacing,
  Text,
  haptic,
} from '@/ui';

const COLLAPSED_ROWS = 8;
const MIN_GAP_MIN = 30;
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** UI05 Agenda: lista por hora y filtro de profesional; sin columnas comprimidas en móvil. */
export default function Agenda() {
  const m = useBusiness();
  const home = useHome();
  const today = home.data?.date;
  const [selected, setSelected] = useState<string | null>(null);
  const day = selected ?? today ?? null;
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [pro, setPro] = useState<string | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);
  const professionals = useProfessionals();
  const canSeeAll = m.permissions.includes('agenda.view_all');
  const canCreate = m.permissions.includes('appointments.manage_all') || m.permissions.includes('appointments.manage_own');

  const weekStart = day ? startOfWeek(day) : null;
  const range = mode === 'day' ? { from: day ?? '', to: day ?? '' } : { from: weekStart ?? '', to: weekStart ? addDays(weekStart, 6) : '' };
  const agenda = useAgenda({ ...range, professionalId: pro }, !!day);
  useRefreshOnFocus(agenda.refetch);
  const tz = agenda.data?.timezone ?? m.timezone;

  const visible = useMemo(
    () => (agenda.data?.appointments ?? []).filter((a) => a.status !== 'CANCELLED' && a.status !== 'REJECTED' && a.status !== 'EXPIRED'),
    [agenda.data],
  );
  const pendingCount = home.data?.pendingApprovalCount ?? 0;
  const daySummary = agenda.data?.days.find((d) => d.date === day);

  return (
    <Screen
      tabTitle={canSeeAll ? 'Agenda' : 'Mi agenda'}
      onRefresh={() => {
        void agenda.refetch();
        void home.refetch();
      }}
      refreshing={agenda.isRefetching}
      footer={canCreate ? <Button label="Nueva cita" icon={Plus} onPress={() => router.push(day ? `/cita/nueva?date=${day}` : '/cita/nueva')} /> : undefined}
    >
      <PageTitle
        title={canSeeAll ? 'Agenda' : 'Mi agenda'}
        trailing={
          <Pressable
            onPress={() => {
              setSelected(null);
              setExpanded(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Ir a hoy"
            style={styles.todayBtn}
          >
            <Text variant="captionStrong" color={colors.primary}>
              Hoy
            </Text>
          </Pressable>
        }
      />

      {weekStart ? (
        <NightCard style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.md }}>
          <View style={styles.monthRow}>
            <Pressable onPress={() => setSelected(addDays(day!, -7))} accessibilityRole="button" accessibilityLabel="Semana anterior" style={styles.arrow}>
              <ChevronLeft size={22} color={colors.textOnNight} />
            </Pressable>
            <Text variant="subheading" color={colors.textOnNight}>
              {fmt.monthYear(noonOf(day!), 'UTC')}
            </Text>
            <Pressable onPress={() => setSelected(addDays(day!, 7))} accessibilityRole="button" accessibilityLabel="Semana siguiente" style={styles.arrow}>
              <ChevronRight size={22} color={colors.textOnNight} />
            </Pressable>
          </View>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => {
              const d = addDays(weekStart, i);
              const active = d === day;
              return (
                <Pressable
                  key={d}
                  onPress={() => {
                    haptic.select();
                    setSelected(d);
                    setExpanded(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={fmt.longDay(noonOf(d), 'UTC')}
                  style={[styles.dayCell, active && styles.dayCellActive]}
                >
                  <Text variant="micro" color={active ? colors.textMuted : colors.textOnNightMuted}>
                    {w}
                  </Text>
                  <Text variant="subheading" color={active ? colors.text : colors.textOnNight}>
                    {Number(d.slice(8))}
                  </Text>
                  {d === today && !active ? <View style={styles.todayDot} /> : null}
                </Pressable>
              );
            })}
          </View>
        </NightCard>
      ) : null}

      <SegmentedControl
        value={mode}
        onChange={setMode}
        options={[
          { value: 'day', label: 'Día' },
          { value: 'week', label: 'Semana' },
        ]}
      />

      {canSeeAll && professionals.data ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Todos" dark selected={!pro} onPress={() => setPro(undefined)} />
          {professionals.data
            .filter((p) => p.active)
            .map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                selected={pro === p.id}
                onPress={() => setPro(pro === p.id ? undefined : p.id)}
                leading={<Avatar initials={p.initials} colorKey={p.colorKey} size={30} />}
              />
            ))}
        </ScrollView>
      ) : null}

      {pendingCount > 0 && m.permissions.includes('appointments.approve') ? (
        <Pressable onPress={() => router.push('/pendientes')} accessibilityRole="button" style={styles.pending}>
          <IconCircle icon={Clock} tone="warning" size={32} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {pendingCount} {pendingCount === 1 ? 'solicitud por aprobar' : 'solicitudes por aprobar'}
          </Text>
          <ChevronRight size={22} color={colors.text} />
        </Pressable>
      ) : null}

      {agenda.isLoading || !day ? <SkeletonList rows={4} /> : null}
      {agenda.error && !agenda.data ? <ErrorState error={agenda.error} onRetry={() => agenda.refetch()} /> : null}

      {agenda.data && mode === 'day' ? (
        <View style={{ gap: spacing.md }}>
          <View style={styles.dayHeader}>
            <Text variant="heading" accessibilityRole="header">
              {fmt.longDay(noonOf(day!), 'UTC')}
            </Text>
            <Text variant="body" color={colors.textMuted}>
              {daySummary?.confirmed ?? 0} {daySummary?.confirmed === 1 ? 'confirmada' : 'confirmadas'}
            </Text>
          </View>
          {visible.length === 0 && agenda.data.blocks.length === 0 ? (
            <EmptyState pose="sleep" title="Sin citas este día" body={canCreate ? 'Agenda una cita o revisa otro día.' : 'Revisa otro día de la semana.'} />
          ) : (
            <Animated.View style={{ gap: spacing.sm }} layout={LinearTransition.springify().damping(18).reduceMotion(ReduceMotion.System)}>
              {timeline(expanded ? visible : visible.slice(0, COLLAPSED_ROWS), agenda.data.blocks.filter((b) => localDate(b.startsAt, tz) === day || localDate(b.endsAt, tz) === day), {
                showNow: day === today ? (agenda.data?.generatedAt ?? null) : null,
                showGaps: !!pro || !canSeeAll,
                tz,
                onBook: () => router.push(day ? `/cita/nueva?date=${day}` : '/cita/nueva'),
                canCreate,
              })}
              {visible.length > COLLAPSED_ROWS ? (
                <Pressable onPress={() => setExpanded(!expanded)} accessibilityRole="button" style={styles.more}>
                  <Text variant="captionStrong" color={colors.primary}>
                    {expanded ? 'Mostrar menos' : `${visible.length - COLLAPSED_ROWS} ${visible.length - COLLAPSED_ROWS === 1 ? 'cita más' : 'citas más'}`}
                  </Text>
                  {expanded ? <ChevronUp size={18} color={colors.primary} /> : <ChevronDown size={18} color={colors.primary} />}
                </Pressable>
              ) : null}
            </Animated.View>
          )}
        </View>
      ) : null}

      {agenda.data && mode === 'week' ? <WeekSummary appointments={visible} days={agenda.data.days} tz={tz} today={today} onPickDay={(d) => {
        setSelected(d);
        setMode('day');
      }} /> : null}

      {agenda.data ? (
        <Text variant="micro" color={colors.textSubtle} align="center">
          Horario de {tz} · actualizado {fmt.time(agenda.data.generatedAt, tz)}
          {agenda.error ? ' · no se pudo actualizar' : ''}
        </Text>
      ) : null}
    </Screen>
  );
}

/** Construye la línea de tiempo: citas, marca de "ahora" y huecos libres (≥ 30 min). */
function timeline(
  list: Appointment[],
  blocks: AgendaResponse['blocks'],
  opts: { showNow: string | null; showGaps: boolean; tz: string; onBook: () => void; canCreate: boolean },
) {
  const out: React.ReactNode[] = [];
  const now = opts.showNow ? new Date(opts.showNow).getTime() : null;
  let nowPlaced = now === null;
  const pending = [...blocks];
  const flushBlocksBefore = (t: number) => {
    while (pending.length && new Date(pending[0]!.startsAt).getTime() <= t) {
      const b = pending.shift()!;
      out.push(<BlockRow key={b.id} block={b} tz={opts.tz} />);
    }
  };
  list.forEach((a, i) => {
    const start = new Date(a.startsAt).getTime();
    flushBlocksBefore(start);
    if (!nowPlaced && now !== null && start > now) {
      out.push(<NowMarker key="now" time={fmt.time(opts.showNow!, opts.tz)} />);
      nowPlaced = true;
    }
    out.push(
      <Appear key={a.id} index={i}>
        <AppointmentRow appt={a} />
      </Appear>,
    );
    const next = list[i + 1];
    const blockInGap = next && pending.some((b) => new Date(b.startsAt).getTime() < new Date(next.startsAt).getTime());
    if (opts.showGaps && opts.canCreate && next && !blockInGap) {
      const end = new Date(a.endsAt).getTime();
      const nextStart = new Date(next.startsAt).getTime();
      const from = Math.max(end, now ?? 0);
      if (nextStart - from >= MIN_GAP_MIN * 60_000) {
        out.push(
          <FreeSlot key={`gap-${a.id}`} from={fmt.time(new Date(from).toISOString(), opts.tz)} to={fmt.time(next.startsAt, opts.tz)} onPress={opts.onBook} />,
        );
      }
    }
  });
  flushBlocksBefore(Number.MAX_SAFE_INTEGER);
  if (!nowPlaced && now !== null && list.length > 0) out.push(<NowMarker key="now" time={fmt.time(opts.showNow!, opts.tz)} />);
  return out;
}

/** Semana resumida: conteos por día y citas compactas (sin cuadrícula multiprofesional). */
function WeekSummary({
  appointments,
  days,
  tz,
  today,
  onPickDay,
}: {
  appointments: Appointment[];
  days: Array<{ date: string; confirmed: number; pending: number }>;
  tz: string;
  today?: string;
  onPickDay: (d: string) => void;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      {days.map((d) => {
        const list = appointments.filter((a) => localDate(a.startsAt, tz) === d.date);
        return (
          <Pressable key={d.date} onPress={() => onPickDay(d.date)} accessibilityRole="button" style={styles.weekDay}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="subheading">
                {fmt.longDay(noonOf(d.date), 'UTC')}
                {d.date === today ? ' · Hoy' : ''}
              </Text>
              <ChevronRight size={20} color={colors.text} />
            </View>
            <Text variant="caption" color={colors.textMuted}>
              {d.confirmed} confirmadas{d.pending ? ` · ${d.pending} por aprobar` : ''}
            </Text>
            {list.slice(0, 3).map((a) => (
              <Text key={a.id} variant="caption" numberOfLines={1}>
                {fmt.time(a.startsAt, tz)} · {a.customer.name} · {a.professional.name}
              </Text>
            ))}
            {list.length > 3 ? (
              <Text variant="caption" color={colors.primary}>
                +{list.length - 3} más
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  todayBtn: {
    minHeight: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  arrow: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 2 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs + 2, borderRadius: radius.md, gap: 0, minHeight: 50 },
  dayCellActive: { backgroundColor: '#F4F1FF' },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  chips: { flexDirection: 'row', gap: spacing.sm },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  dayHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: 44 },
  weekDay: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 },
});
