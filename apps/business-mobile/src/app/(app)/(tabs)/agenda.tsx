import type { Appointment } from '@orion/contracts';
import { router } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppointmentRow } from '@/features/AppointmentRow';
import { addDays, fmt, localDate, noonOf, startOfWeek } from '@/lib/format';
import { useAgenda, useHome, useProfessionals } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { useRefreshOnFocus } from '@/lib/use-refresh-on-focus';
import {
  AppHeader,
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
  SimulationBanner,
  SkeletonList,
  spacing,
  Text,
} from '@/ui';

const COLLAPSED_ROWS = 4;
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
      onRefresh={() => {
        void agenda.refetch();
        void home.refetch();
      }}
      refreshing={agenda.isRefetching}
      footer={canCreate ? <Button label="Nueva cita" icon={Plus} onPress={() => router.push(day ? `/cita/nueva?date=${day}` : '/cita/nueva')} /> : undefined}
    >
      <AppHeader />
      <SimulationBanner />
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
            <Text variant="subheading" color={colors.primary}>
              Hoy
            </Text>
          </Pressable>
        }
      />

      {weekStart ? (
        <NightCard style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.lg }}>
          <View style={styles.monthRow}>
            <Pressable onPress={() => setSelected(addDays(day!, -7))} accessibilityRole="button" accessibilityLabel="Semana anterior" style={styles.arrow}>
              <ChevronLeft size={28} color={colors.textOnNight} />
            </Pressable>
            <Text variant="heading" color={colors.textOnNight}>
              {fmt.monthYear(noonOf(day!), 'UTC')}
            </Text>
            <Pressable onPress={() => setSelected(addDays(day!, 7))} accessibilityRole="button" accessibilityLabel="Semana siguiente" style={styles.arrow}>
              <ChevronRight size={28} color={colors.textOnNight} />
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
                    setSelected(d);
                    setExpanded(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={fmt.longDay(noonOf(d), 'UTC')}
                  style={[styles.dayCell, active && styles.dayCellActive]}
                >
                  <Text variant="body" color={active ? colors.text : colors.textOnNightMuted}>
                    {w}
                  </Text>
                  <Text variant="heading" color={active ? colors.text : colors.textOnNight} style={{ fontSize: 22 }}>
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
          <IconCircle icon={Clock} tone="warning" size={52} />
          <Text variant="subheading" style={{ flex: 1 }}>
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
            <Text variant="title" accessibilityRole="header">
              {fmt.longDay(noonOf(day!), 'UTC')}
            </Text>
            <Text variant="body" color={colors.textMuted}>
              {daySummary?.confirmed ?? 0} {daySummary?.confirmed === 1 ? 'confirmada' : 'confirmadas'}
            </Text>
          </View>
          {visible.length === 0 ? (
            <EmptyState title="Sin citas este día" body={canCreate ? 'Agenda una cita o revisa otro día.' : 'Revisa otro día de la semana.'} />
          ) : (
            <View style={{ gap: spacing.md }}>
              {(expanded ? visible : visible.slice(0, COLLAPSED_ROWS)).map((a) => (
                <AppointmentRow key={a.id} appt={a} />
              ))}
              {visible.length > COLLAPSED_ROWS ? (
                <Pressable onPress={() => setExpanded(!expanded)} accessibilityRole="button" style={styles.more}>
                  <Text variant="bodyStrong" color={colors.primary}>
                    {expanded ? 'Mostrar menos' : `${visible.length - COLLAPSED_ROWS} ${visible.length - COLLAPSED_ROWS === 1 ? 'cita más' : 'citas más'}`}
                  </Text>
                  {expanded ? <ChevronUp size={20} color={colors.primary} /> : <ChevronDown size={20} color={colors.primary} />}
                </Pressable>
              ) : null}
            </View>
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
    minHeight: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  arrow: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 2 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, gap: 2, minHeight: 64 },
  dayCellActive: { backgroundColor: '#F4F1FF' },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  chips: { flexDirection: 'row', gap: spacing.sm },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  dayHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: 44 },
  weekDay: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 },
});
