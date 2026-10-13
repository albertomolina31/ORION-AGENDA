import { fmt } from '@/lib/format';
import { useProfessionals, useServices } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { Badge, Card, colors, Divider, ErrorState, Note, Screen, SkeletonList, spacing, StackHeader, Text } from '@/ui';
import { View } from 'react-native';

/** UI12 Servicios (lectura). Editar llega con P17; cambiar precio/duración no altera citas existentes. */
export default function Services() {
  const m = useBusiness();
  const services = useServices();
  const pros = useProfessionals();
  const name = (id: string) => pros.data?.find((p) => p.id === id)?.name ?? '';
  return (
    <Screen header={<StackHeader title="Servicios" subtitle={m.businessName} />} onRefresh={() => services.refetch()} refreshing={services.isRefetching}>
      <Note body="Vista de solo lectura en esta iteración. Los cambios de precio o duración aplicarán solo a nuevas reservas." />
      {services.isLoading ? <SkeletonList rows={4} /> : null}
      {services.error ? <ErrorState error={services.error} onRetry={() => services.refetch()} /> : null}
      <Card padded={false}>
        {services.data?.map((s, i) => (
          <View key={s.id}>
            {i > 0 ? <Divider /> : null}
            <View style={{ padding: spacing.lg, gap: 4, opacity: s.active ? 1 : 0.6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="subheading" style={{ flex: 1 }}>
                  {s.name}
                </Text>
                {!s.active ? <Badge label="Archivado" /> : null}
              </View>
              <Text variant="body" color={colors.textMuted}>
                {s.durationMin} min{s.bufferAfterMin ? ` + ${s.bufferAfterMin} min de preparación` : ''} · {fmt.money(s.price)}
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                {s.professionalIds.length ? `Realizan: ${s.professionalIds.map(name).join(', ')}` : 'Sin profesionales asignados'}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
