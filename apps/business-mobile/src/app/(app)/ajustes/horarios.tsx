import type { ScheduleConflict } from '@orion/contracts';
import { router } from 'expo-router';
import { CalendarOff, Check, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Switch, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ConflictList } from '@/features/ConflictList';
import { TimeStepper } from '@/features/TimeStepper';
import { endpoints } from '@/lib/endpoints';
import { fmt, noonOf } from '@/lib/format';
import { useIdempotentMutation } from '@/lib/mutations';
import { useHome, useProfessionals, useSchedules } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { useRefreshOnFocus } from '@/lib/use-refresh-on-focus';
import { Appear, Avatar, Button, Card, Chip, colors, Divider, ErrorState, haptic, LinkButton, Note, PressableScale, Screen, SectionHeader, SkeletonList, spacing, StackHeader, Text, useFeedback } from '@/ui';

const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
type Range = { start: string; end: string };
type Week = Record<number, Range[]>;

/**
 * UI14 Horarios: jornada semanal por profesional (o del negocio), excepciones y bloqueos.
 * Guardar primero calcula conflictos; si hay citas afectadas, se muestran y no se aplica nada.
 */
export default function Schedules() {
  const m = useBusiness();
  const q = useSchedules();
  const pros = useProfessionals();
  const home = useHome();
  const feedback = useFeedback();
  const canEdit = m.permissions.includes('schedules.manage');
  const [target, setTarget] = useState<string | null>(m.role === 'PROFESSIONAL' ? m.professionalId : null);
  const [week, setWeek] = useState<Week>({});
  const [dirty, setDirty] = useState(false);
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [checking, setChecking] = useState(false);
  useRefreshOnFocus(q.refetch);

  const current = useMemo(() => {
    if (!q.data) return null;
    const src = target === null ? q.data.business : q.data.professionals.find((p) => p.professionalId === target);
    const w: Week = {};
    src?.days.forEach((d) => (w[d.weekday] = d.intervals.map((r) => ({ ...r }))));
    return w;
  }, [q.data, target]);
  useEffect(() => {
    if (current) {
      setWeek(current);
      setDirty(false);
      setConflicts(null);
    }
  }, [current]);

  const now = home.data ? new Date(home.data.generatedAt) : new Date();
  const blocks = useQuery({
    queryKey: ['blocks', m.businessId],
    queryFn: () => endpoints.blocks(m.businessId, now.toISOString(), new Date(now.getTime() + 60 * 86_400_000).toISOString()),
    enabled: !!home.data,
  });

  const save = useIdempotentMutation(
    (_: void, requestId) =>
      endpoints.setWeeklyHours(m.businessId, {
        requestId,
        professionalId: target,
        days: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ weekday: d, intervals: week[d] ?? [] })),
      }),
    [['schedules', m.businessId], ['availability', m.businessId]],
  );
  const delException = useIdempotentMutation((exId: string, requestId) => endpoints.deleteException(m.businessId, exId, requestId), [['schedules', m.businessId]]);
  const delBlock = useIdempotentMutation((blkId: string, requestId) => endpoints.removeBlock(m.businessId, blkId, requestId), [['blocks', m.businessId], ['agenda', m.businessId]]);

  const update = (day: number, ranges: Range[]) => {
    setWeek({ ...week, [day]: ranges });
    setDirty(true);
    setConflicts(null);
  };

  const apply = async () => {
    setChecking(true);
    try {
      const preview = await endpoints.setWeeklyHours(m.businessId, {
        requestId: 'preview-only',
        professionalId: target,
        dryRun: true,
        days: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ weekday: d, intervals: week[d] ?? [] })),
      });
      if (preview.conflicts.length) {
        setConflicts(preview.conflicts);
        haptic.warning();
        return;
      }
      save.mutate(undefined, {
        onSuccess: () => {
          setDirty(false);
          feedback.toast('Horario actualizado');
        },
        onError: (e) => {
          save.resetKey();
          const c = e.details?.['conflicts'] as ScheduleConflict[] | undefined;
          if (c) setConflicts(c);
          else feedback.toast(e.message, 'error');
        },
      });
    } catch (e) {
      feedback.toast((e as Error).message, 'error');
    } finally {
      setChecking(false);
    }
  };

  const exceptions = (q.data?.exceptions ?? []).filter((e) => e.professionalId === target || (target !== null && e.professionalId === null));
  const name = (id: string | null) => (id ? (pros.data?.find((p) => p.id === id)?.name ?? '') : 'Todo el negocio');

  return (
    <Screen
      header={<StackHeader title="Horarios y bloqueos" subtitle={m.businessName} />}
      onRefresh={() => {
        void q.refetch();
        void blocks.refetch();
      }}
      refreshing={q.isRefetching}
      footer={canEdit && dirty ? <Button requiresOnline label="Guardar horario" icon={Check} loading={checking || save.isPending} onPress={apply} /> : undefined}
    >
      {m.role !== 'PROFESSIONAL' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Chip label="Negocio" dark selected={target === null} onPress={() => setTarget(null)} />
          {pros.data
            ?.filter((p) => p.active)
            .map((p) => (
              <Chip key={p.id} label={p.name} selected={target === p.id} onPress={() => setTarget(p.id)} leading={<Avatar initials={p.initials} colorKey={p.colorKey} size={22} />} />
            ))}
        </View>
      ) : null}

      {q.isLoading ? <SkeletonList rows={4} /> : null}
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}

      {conflicts ? <ConflictList conflicts={conflicts} tz={m.timezone} title={`El cambio deja ${conflicts.length} ${conflicts.length === 1 ? 'cita' : 'citas'} fuera del horario`} /> : null}

      {q.data ? (
        <Appear>
          <SectionHeader title={target === null ? 'Horario del negocio' : `Jornada de ${name(target)}`} />
          <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
            {target === null ? 'Límite general de apertura. Cada profesional trabaja dentro de este horario.' : 'Usa dos tramos para una jornada partida (con descanso).'} Hora de {q.data.timezone}.
          </Text>
          <Card padded={false}>
            {[1, 2, 3, 4, 5, 6, 7].map((d, i) => (
              <View key={d}>
                {i > 0 ? <Divider /> : null}
                <DayEditor day={d} ranges={week[d] ?? []} onChange={(r) => update(d, r)} disabled={!canEdit} />
              </View>
            ))}
          </Card>
        </Appear>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title="Excepciones" actionLabel={canEdit ? 'Agregar' : undefined} onAction={() => router.push(`/ajustes/excepcion${target ? `?pro=${target}` : ''}`)} />
        {exceptions.length === 0 ? (
          <Text variant="caption" color={colors.textMuted}>
            Sin cierres ni horarios especiales próximos.
          </Text>
        ) : (
          <Card padded={false}>
            {exceptions.map((e, i) => (
              <View key={e.id}>
                {i > 0 ? <Divider /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md }}>
                  <CalendarOff size={20} color={e.closed ? colors.danger : colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{fmt.longDay(noonOf(e.date), 'UTC')}</Text>
                    <Text variant="caption" color={colors.textMuted}>
                      {name(e.professionalId)} · {e.closed ? 'Cerrado' : e.intervals.map((r) => `${r.start}–${r.end}`).join(', ')}
                      {e.reason ? ` · ${e.reason}` : ''}
                    </Text>
                  </View>
                  {canEdit ? (
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel="Quitar excepción"
                      onPress={async () => {
                        const r = await feedback.confirm({ title: 'Quitar excepción', message: 'Ese día volverá a la jornada habitual.', confirmLabel: 'Quitar', destructive: true });
                        if (r.confirmed)
                          delException.mutate(e.id, {
                            onSuccess: () => feedback.toast('Excepción eliminada'),
                            onError: (err) => feedback.toast(err.message, 'error'),
                          });
                      }}
                    >
                      <Trash2 size={18} color={colors.danger} />
                    </PressableScale>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        )}
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title="Bloqueos próximos" actionLabel={canEdit ? 'Nuevo' : undefined} onAction={() => router.push(`/bloqueo${target ? `?pro=${target}` : ''}`)} />
        {(blocks.data ?? []).filter((b) => target === null || b.professionalId === target).length === 0 ? (
          <Text variant="caption" color={colors.textMuted}>
            Sin bloqueos en los próximos 60 días.
          </Text>
        ) : (
          <Card padded={false}>
            {(blocks.data ?? [])
              .filter((b) => target === null || b.professionalId === target)
              .map((b, i) => (
                <View key={b.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md }}>
                    <Avatar initials={b.professionalName.charAt(0)} colorKey={b.colorKey} size={30} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">
                        {fmt.weekdayShort(b.startsAt, m.timezone)} · {fmt.range(b.startsAt, b.endsAt, m.timezone)}
                      </Text>
                      <Text variant="caption" color={colors.textMuted}>
                        {b.professionalName}
                        {b.reason ? ` · ${b.reason}` : ''}
                      </Text>
                    </View>
                    {canEdit ? (
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel="Quitar bloqueo"
                        onPress={async () => {
                          const r = await feedback.confirm({ title: 'Quitar bloqueo', message: 'El horario volverá a estar disponible para reservas.', confirmLabel: 'Quitar', destructive: true });
                          if (r.confirmed) delBlock.mutate(b.id, { onSuccess: () => feedback.toast('Bloqueo eliminado'), onError: (err) => feedback.toast(err.message, 'error') });
                        }}
                      >
                        <Trash2 size={18} color={colors.danger} />
                      </PressableScale>
                    ) : null}
                  </View>
                </View>
              ))}
          </Card>
        )}
      </View>
      {!canEdit ? <Note body="Solo lectura: tu rol no permite editar horarios." /> : null}
    </Screen>
  );
}

function DayEditor({ day, ranges, onChange, disabled }: { day: number; ranges: Range[]; onChange: (r: Range[]) => void; disabled: boolean }) {
  const open = ranges.length > 0;
  return (
    <View style={{ padding: spacing.md, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {DAYS[day]}
        </Text>
        <Text variant="caption" color={open ? colors.success : colors.textSubtle} style={{ marginRight: spacing.sm }}>
          {open ? 'Abierto' : 'Cerrado'}
        </Text>
        <Switch
          value={open}
          disabled={disabled}
          onValueChange={(v) => onChange(v ? [{ start: '09:00', end: '18:00' }] : [])}
          accessibilityLabel={`${DAYS[day]} abierto`}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.surface}
        />
      </View>
      {ranges.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
          <TimeStepper label="Inicio" value={r.start} onChange={(v) => onChange(ranges.map((x, j) => (j === i ? { ...x, start: v } : x)))} />
          <Text variant="caption" color={colors.textMuted}>
            a
          </Text>
          <TimeStepper label="Fin" value={r.end} onChange={(v) => onChange(ranges.map((x, j) => (j === i ? { ...x, end: v } : x)))} />
          {ranges.length > 1 && !disabled ? (
            <PressableScale accessibilityRole="button" accessibilityLabel="Quitar tramo" onPress={() => onChange(ranges.filter((_, j) => j !== i))}>
              <Trash2 size={16} color={colors.textSubtle} />
            </PressableScale>
          ) : null}
        </View>
      ))}
      {open && ranges.length < 2 && !disabled ? (
        <LinkButton
          label="Agregar descanso"
          chevron={false}
          onPress={() => {
            const r = ranges[0]!;
            // Divide la jornada en dos tramos con una hora de descanso a la mitad.
            const [sh, sm] = r.start.split(':').map(Number) as [number, number];
            const [eh, em] = r.end.split(':').map(Number) as [number, number];
            const mid = Math.round((sh * 60 + sm + eh * 60 + em) / 2 / 15) * 15;
            const t = (x: number) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
            onChange([{ start: r.start, end: t(mid - 30) }, { start: t(mid + 30), end: r.end }]);
          }}
        />
      ) : null}
    </View>
  );
}
