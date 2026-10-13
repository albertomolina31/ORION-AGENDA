import { router } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { View } from 'react-native';
import { fmt } from '@/lib/format';
import { useProfessionals, useServices } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { useRefreshOnFocus } from '@/lib/use-refresh-on-focus';
import { Appear, Badge, Button, Card, colors, Divider, EmptyState, ErrorState, PressableScale, Screen, SkeletonList, spacing, StackHeader, Text } from '@/ui';

/** UI12 Servicios: catálogo editable. Cambiar precio o duración aplica solo a nuevas reservas. */
export default function Services() {
  const m = useBusiness();
  const services = useServices();
  const pros = useProfessionals();
  useRefreshOnFocus(services.refetch);
  const canEdit = m.permissions.includes('catalog.manage');
  const name = (id: string) => pros.data?.find((p) => p.id === id)?.name ?? '';
  const active = services.data?.filter((s) => s.active) ?? [];
  const archived = services.data?.filter((s) => !s.active) ?? [];

  const row = (s: NonNullable<typeof services.data>[number], i: number, last: boolean) => (
    <Appear key={s.id} index={i}>
      <PressableScale onPress={() => router.push(`/ajustes/servicio/${s.id}`)} disabled={!canEdit} accessibilityRole="button" scaleTo={0.985}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="subheading">{s.name}</Text>
            <Text variant="caption" color={colors.textMuted}>
              {s.durationMin} min{s.bufferBeforeMin + s.bufferAfterMin ? ` + ${s.bufferBeforeMin + s.bufferAfterMin} min de preparación` : ''} · {fmt.money(s.price)}
            </Text>
            <Text variant="caption" color={s.professionalIds.length ? colors.textMuted : colors.accentInk}>
              {s.professionalIds.length ? `Realizan: ${s.professionalIds.map(name).join(', ')}` : 'Sin profesionales: no se puede reservar'}
            </Text>
          </View>
          {!s.active ? <Badge label="Archivado" /> : null}
          {canEdit ? <ChevronRight size={18} color={colors.textSubtle} /> : null}
        </View>
      </PressableScale>
      {!last ? <Divider /> : null}
    </Appear>
  );

  return (
    <Screen
      header={<StackHeader title="Servicios" subtitle={m.businessName} />}
      onRefresh={() => services.refetch()}
      refreshing={services.isRefetching}
      footer={canEdit ? <Button label="Nuevo servicio" icon={Plus} onPress={() => router.push('/ajustes/servicio/nuevo')} /> : undefined}
    >
      {services.isLoading ? <SkeletonList rows={4} /> : null}
      {services.error ? <ErrorState error={services.error} onRetry={() => services.refetch()} /> : null}
      {services.data && services.data.length === 0 ? <EmptyState pose="point" title="Aún no hay servicios" body="Crea el primero para empezar a recibir reservas." /> : null}
      {active.length ? <Card padded={false}>{active.map((s, i) => row(s, i, i === active.length - 1))}</Card> : null}
      {archived.length ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="subheading" color={colors.textMuted}>
            Archivados
          </Text>
          <Card padded={false}>{archived.map((s, i) => row(s, i, i === archived.length - 1))}</Card>
          <Text variant="caption" color={colors.textMuted}>
            No aparecen en nuevas reservas; su historial se conserva.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
