import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { endpoints } from '@/lib/endpoints';
import { useProfessionals } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { Card, colors, Divider, ErrorState, Note, Screen, SkeletonList, spacing, StackHeader, Text } from '@/ui';

const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** UI14 Horarios (lectura). Jornada partida: un servicio debe caber íntegro en un intervalo. */
export default function Schedules() {
  const m = useBusiness();
  const q = useQuery({ queryKey: ['schedules', m.businessId], queryFn: () => endpoints.schedules(m.businessId) });
  const pros = useProfessionals();
  const name = (id: string | null) => (id ? (pros.data?.find((p) => p.id === id)?.name ?? '') : 'Negocio');
  return (
    <Screen header={<StackHeader title="Horarios y bloqueos" subtitle={m.businessName} />}>
      <Note
        tone="warning"
        title="Bloqueos y edición en la siguiente iteración (P19)"
        body="Cambiar una jornada con citas existentes mostrará los conflictos y pedirá resolverlos; nunca se cancelan citas en silencio."
      />
      {q.isLoading ? <SkeletonList rows={3} /> : null}
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}
      {q.data
        ? [q.data.business, ...q.data.professionals].map((s) => (
            <Card key={s.professionalId ?? 'biz'}>
              <Text variant="heading" style={{ marginBottom: spacing.sm }}>
                {name(s.professionalId)}
              </Text>
              {[1, 2, 3, 4, 5, 6, 7].map((d, i) => {
                const day = s.days.find((x) => x.weekday === d);
                return (
                  <View key={d}>
                    {i > 0 ? <Divider /> : null}
                    <View style={{ flexDirection: 'row', paddingVertical: spacing.sm }}>
                      <Text variant="body" style={{ width: 110 }}>
                        {DAYS[d]}
                      </Text>
                      <Text variant="body" color={day?.intervals.length ? colors.text : colors.textSubtle} style={{ flex: 1 }}>
                        {day?.intervals.length ? day.intervals.map((r) => `${r.start}–${r.end}`).join('  ·  ') : 'Cerrado'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          ))
        : null}
      <Text variant="micro" color={colors.textSubtle} align="center">
        Horario de {q.data?.timezone ?? m.timezone}
      </Text>
    </Screen>
  );
}
