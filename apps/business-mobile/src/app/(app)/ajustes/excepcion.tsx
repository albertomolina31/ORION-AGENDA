import type { ScheduleConflict } from '@orion/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ConflictList } from '@/features/ConflictList';
import { DateStrip } from '@/features/SlotPicker';
import { TimeStepper } from '@/features/TimeStepper';
import { endpoints } from '@/lib/endpoints';
import { fmt, noonOf } from '@/lib/format';
import { useIdempotentMutation } from '@/lib/mutations';
import { useHome, useProfessionals } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { Avatar, Button, Card, Chip, colors, Field, haptic, Screen, SegmentedControl, spacing, StackHeader, Text, useFeedback } from '@/ui';

/** Excepción por fecha: cierre o horario especial. Si hay citas ese día, se listan y no se aplica. */
export default function NewException() {
  const params = useLocalSearchParams<{ pro?: string }>();
  const m = useBusiness();
  const home = useHome();
  const pros = useProfessionals();
  const feedback = useFeedback();
  const [pro, setPro] = useState<string | null>(params.pro ?? null);
  const [date, setDate] = useState<string | null>(null);
  const [mode, setMode] = useState<'closed' | 'special'>('closed');
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('14:00');
  const [reason, setReason] = useState('');
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    if (!date && home.data) setDate(home.data.date);
  }, [home.data, date]);
  useEffect(() => setConflicts(null), [pro, date, mode, start, end]);

  const save = useIdempotentMutation(
    (_: void, requestId) =>
      endpoints.saveException(m.businessId, { requestId, professionalId: pro, date: date!, closed: mode === 'closed', intervals: mode === 'closed' ? [] : [{ start, end }], reason: reason || undefined }),
    [['schedules', m.businessId]],
  );

  const submit = async () => {
    if (!date) return;
    setChecking(true);
    try {
      const preview = await endpoints.saveException(m.businessId, {
        requestId: 'preview-only',
        dryRun: true,
        professionalId: pro,
        date,
        closed: mode === 'closed',
        intervals: mode === 'closed' ? [] : [{ start, end }],
      });
      if (preview.conflicts.length) {
        haptic.warning();
        setConflicts(preview.conflicts);
        return;
      }
      save.mutate(undefined, {
        onSuccess: () => {
          feedback.toast(mode === 'closed' ? 'Día cerrado' : 'Horario especial guardado');
          if (router.canGoBack()) router.back();
        else router.replace('/');
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

  return (
    <Screen header={<StackHeader title="Nueva excepción" subtitle={m.businessName} />} footer={<Button label="Guardar excepción" icon={Check} loading={checking || save.isPending} disabled={!date || (mode === 'special' && end <= start)} onPress={submit} />}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="subheading">¿Para quién?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Chip label="Todo el negocio" dark selected={pro === null} onPress={() => setPro(null)} />
          {pros.data
            ?.filter((p) => p.active)
            .map((p) => (
              <Chip key={p.id} label={p.name} selected={pro === p.id} onPress={() => setPro(p.id)} leading={<Avatar initials={p.initials} colorKey={p.colorKey} size={22} />} />
            ))}
        </View>
      </View>
      {date && home.data ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="subheading">{fmt.longDay(noonOf(date), 'UTC')}</Text>
          <DateStrip start={home.data.date} days={30} value={date} onChange={setDate} />
        </View>
      ) : null}
      <SegmentedControl
        value={mode}
        onChange={setMode}
        options={[
          { value: 'closed', label: 'Cerrado' },
          { value: 'special', label: 'Horario especial' },
        ]}
      />
      {mode === 'special' ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
            <TimeStepper label="Inicio" value={start} onChange={setStart} />
            <Text variant="caption" color={colors.textMuted}>
              a
            </Text>
            <TimeStepper label="Fin" value={end} onChange={setEnd} />
          </View>
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
            Sustituye la jornada habitual solo ese día.
          </Text>
        </Card>
      ) : null}
      <Field label="Motivo (opcional)" value={reason} onChangeText={setReason} placeholder="Ej. día festivo, capacitación" maxLength={80} />
      {conflicts ? <ConflictList conflicts={conflicts} tz={m.timezone} title={`Hay ${conflicts.length} ${conflicts.length === 1 ? 'cita' : 'citas'} ese día`} /> : null}
    </Screen>
  );
}
