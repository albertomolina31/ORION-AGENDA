import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowDown, Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DateStrip, SlotGrid } from '@/features/SlotPicker';
import { endpoints } from '@/lib/endpoints';
import { fmt, localDate, noonOf } from '@/lib/format';
import { useIdempotentMutation } from '@/lib/mutations';
import { useAppointment, useHome, useProfessionals, useServices } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { Avatar, Button, Card, Chip, colors, ErrorState, LoadingState, Note, Screen, spacing, StackHeader, Text, useFeedback } from '@/ui';

/** UI08 Reprogramar: horario actual visible y comparación antes/después. Un conflicto conserva el original. */
export default function Reschedule() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const m = useBusiness();
  const appt = useAppointment(id);
  const home = useHome();
  const a = appt.data;
  const [date, setDate] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proId, setProId] = useState<string | null>(null);
  const pros = useProfessionals();
  const services = useServices();
  const feedback = useFeedback();
  const selectedPro = proId ?? a?.professional.id;
  const eligible = (pros.data ?? []).filter((p) => p.active && services.data?.find((s) => s.id === a?.service.id)?.professionalIds.includes(p.id));

  useEffect(() => {
    if (a && !date) setDate(localDate(a.startsAt, a.timezone));
  }, [a, date]);

  const availability = useQuery({
    queryKey: ['availability', m.businessId, a?.service.id, selectedPro, date, id],
    queryFn: () =>
      endpoints.availability(m.businessId, { serviceId: a!.service.id, professionalId: selectedPro, date: date!, excludeAppointmentId: id }),
    enabled: !!a && !!date,
  });

  const mutation = useIdempotentMutation(
    (_: void, requestId) =>
      endpoints.reschedule(m.businessId, id, {
        requestId,
        expectedVersion: a!.version,
        startsAt: startsAt!,
        ...(selectedPro && selectedPro !== a!.professional.id ? { professionalId: selectedPro } : {}),
      }),
    [['appointment', m.businessId, id], ['agenda', m.businessId], ['home', m.businessId]],
  );

  if (appt.isLoading || !date) return <LoadingState />;
  if (appt.error || !a) return <ErrorState error={appt.error} onRetry={() => appt.refetch()} />;
  const tz = a.timezone;
  const unchanged = startsAt === a.startsAt && selectedPro === a.professional.id;

  return (
    <Screen
      header={<StackHeader title="Reprogramar" subtitle={`${a.customer.name} · ${a.service.name}`} />}
      footer={
        <Button requiresOnline
          label="Confirmar cambio"
          icon={Check}
          disabled={!startsAt || unchanged}
          loading={mutation.isPending}
          onPress={() => {
            setError(null);
            mutation.mutate(undefined, {
              onSuccess: () => {
                feedback.toast('Cita reprogramada');
                router.back();
              },
              onError: (err) => {
                if (err.code === 'SLOT_UNAVAILABLE') {
                  setError('Ese horario ya no está disponible. Tu cita original sigue igual.');
                  setStartsAt(null);
                  mutation.resetKey();
                  void availability.refetch();
                } else if (err.code === 'STALE_VERSION') {
                  setError('La cita cambió mientras estaba abierta. Revisa el detalle actualizado.');
                  mutation.resetKey();
                  void appt.refetch();
                } else {
                  setError(err.uncertain ? 'No sabemos si se aplicó el cambio. Intenta de nuevo: no se duplicará.' : err.message);
                }
              },
            });
          }}
        />
      }
    >
      <Card>
        <Text variant="caption" color={colors.textMuted}>
          Horario actual
        </Text>
        <Text variant="heading">
          {fmt.longDay(noonOf(localDate(a.startsAt, tz)), 'UTC')} · {fmt.range(a.startsAt, a.endsAt, tz)}
        </Text>
        <Text variant="caption" color={colors.textMuted}>
          Con {a.professional.name}
        </Text>
      </Card>
      {startsAt ? (
        <>
          <View style={{ alignItems: 'center' }}>
            <ArrowDown size={24} color={colors.primary} />
          </View>
          <Card tone="accent">
            <Text variant="caption" color={colors.textMuted}>
              Nuevo horario
            </Text>
            <Text variant="heading">
              {fmt.longDay(noonOf(localDate(startsAt, tz)), 'UTC')} · {fmt.time(startsAt, tz)}
            </Text>
          </Card>
        </>
      ) : null}
      {error ? <Note tone="warning" body={error} /> : null}
      {eligible.length > 1 ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="subheading">Profesional</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {eligible.map((p) => (
              <Chip
                key={p.id}
                label={p.id === a.professional.id ? `${p.name} (actual)` : p.name}
                selected={selectedPro === p.id}
                onPress={() => {
                  setProId(p.id);
                  setStartsAt(null);
                }}
                leading={<Avatar initials={p.initials} colorKey={p.colorKey} size={22} />}
              />
            ))}
          </View>
        </View>
      ) : null}
      <View style={{ gap: spacing.md }}>
        <DateStrip
          start={home.data?.date ?? date}
          value={date}
          onChange={(d) => {
            setDate(d);
            setStartsAt(null);
          }}
        />
        <SlotGrid data={availability.data} loading={availability.isLoading} error={availability.error} onRetry={() => availability.refetch()} value={startsAt} onChange={setStartsAt} />
      </View>
    </Screen>
  );
}
