import { router, useLocalSearchParams } from 'expo-router';
import { CalendarX } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DateStrip } from '@/features/SlotPicker';
import { TimeStepper, toMin, toTime } from '@/features/TimeStepper';
import { endpoints } from '@/lib/endpoints';
import { fmt, noonOf } from '@/lib/format';
import { useIdempotentMutation } from '@/lib/mutations';
import { useHome, useProfessionals } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { Avatar, Button, Card, Chip, colors, Field, Note, Ori, Screen, spacing, StackHeader, Text, useFeedback } from '@/ui';

/** Convierte fecha local + HH:mm en ISO con la zona del negocio (vía offset calculado por Intl). */
function zonedIso(date: string, time: string, tz: string): string {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  const offset = asLocal - guess.getTime();
  return new Date(guess.getTime() - offset).toISOString();
}

/** Bloqueo manual: protege el horario igual que una cita (no se puede bloquear encima de una reservada). */
export default function NewBlock() {
  const params = useLocalSearchParams<{ pro?: string }>();
  const m = useBusiness();
  const home = useHome();
  const pros = useProfessionals();
  const feedback = useFeedback();
  const active = (pros.data ?? []).filter((p) => p.active && (m.role !== 'PROFESSIONAL' || p.id === m.professionalId));
  const [pro, setPro] = useState<string | null>(params.pro ?? (m.role === 'PROFESSIONAL' ? m.professionalId : null));
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState('13:00');
  const [end, setEnd] = useState('14:00');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date && home.data) {
      setDate(home.data.date);
      const nowMin = toMin(fmt.time(home.data.generatedAt, m.timezone));
      const next = Math.min(22 * 60, Math.ceil((nowMin + 1) / 30) * 30);
      setStart(toTime(next));
      setEnd(toTime(Math.min(23 * 60 + 45, next + 60)));
    }
  }, [home.data, date, m.timezone]);
  useEffect(() => {
    if (!pro && active[0]) setPro(active[0].id);
  }, [active, pro]);

  const create = useIdempotentMutation(
    (_: void, requestId) =>
      endpoints.createBlock(m.businessId, {
        requestId,
        professionalId: pro!,
        startsAt: zonedIso(date!, start, m.timezone),
        endsAt: zonedIso(date!, end, m.timezone),
        reason: reason || undefined,
      }),
    [['blocks', m.businessId], ['agenda', m.businessId], ['home', m.businessId]],
  );

  return (
    <Screen
      header={<StackHeader title="Bloquear horario" subtitle={m.businessName} />}
      footer={
        <Button requiresOnline
          label="Bloquear"
          icon={CalendarX}
          disabled={!pro || !date || end <= start}
          loading={create.isPending}
          onPress={() => {
            setError(null);
            create.mutate(undefined, {
              onSuccess: () => {
                feedback.toast('Horario bloqueado');
                if (router.canGoBack()) router.back();
        else router.replace('/');
              },
              onError: (e) => {
                if (!e.uncertain) create.resetKey();
                setError(e.uncertain ? 'No sabemos si se guardó. Intenta de nuevo: no se duplicará.' : e.message);
              },
            });
          }}
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Ori pose="calendar" size={72} />
        <Text variant="body" color={colors.textMuted} style={{ flex: 1 }}>
          Reserva tiempo para pausas, trámites o pendientes. Nadie podrá agendar en ese horario.
        </Text>
      </View>
      {m.role !== 'PROFESSIONAL' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {active.map((p) => (
            <Chip key={p.id} label={p.name} selected={pro === p.id} onPress={() => setPro(p.id)} leading={<Avatar initials={p.initials} colorKey={p.colorKey} size={22} />} />
          ))}
        </View>
      ) : null}
      {date && home.data ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="subheading">{fmt.longDay(noonOf(date), 'UTC')}</Text>
          <DateStrip start={home.data.date} days={21} value={date} onChange={setDate} />
        </View>
      ) : null}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
          <TimeStepper label="Desde" value={start} onChange={setStart} />
          <Text variant="caption" color={colors.textMuted}>
            a
          </Text>
          <TimeStepper label="Hasta" value={end} onChange={setEnd} />
        </View>
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
          Hora del negocio ({m.timezone}).
        </Text>
      </Card>
      <Field label="Motivo (opcional)" value={reason} onChangeText={setReason} placeholder="Ej. comida, trámite, capacitación" maxLength={80} />
      {error ? <Note tone="warning" body={error} /> : null}
    </Screen>
  );
}
