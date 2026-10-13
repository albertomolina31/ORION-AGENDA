import { router } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { View } from 'react-native';
import { useProfessionals, useServices } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { useRefreshOnFocus } from '@/lib/use-refresh-on-focus';
import { Appear, Avatar, Badge, Button, Card, colors, Divider, ErrorState, Note, PressableScale, Screen, SkeletonList, spacing, StackHeader, Text } from '@/ui';

/** UI13 Equipo. Un profesional puede existir sin usuario de acceso. */
export default function Team() {
  const m = useBusiness();
  const pros = useProfessionals();
  const services = useServices();
  useRefreshOnFocus(pros.refetch);
  const canEdit = m.permissions.includes('catalog.manage') || m.permissions.includes('team.manage');
  return (
    <Screen
      header={<StackHeader title="Equipo y permisos" subtitle={m.businessName} />}
      onRefresh={() => pros.refetch()}
      refreshing={pros.isRefetching}
      footer={m.permissions.includes('team.manage') ? <Button label="Nuevo profesional" icon={Plus} onPress={() => router.push('/ajustes/profesional/nuevo')} /> : undefined}
    >
      <Note body="No es necesario que cada profesional instale la app para asignarle citas. Las invitaciones de acceso llegan después." />
      {pros.isLoading ? <SkeletonList rows={3} /> : null}
      {pros.error ? <ErrorState error={pros.error} onRetry={() => pros.refetch()} /> : null}
      <Card padded={false}>
        {pros.data?.map((p, i) => (
          <Appear key={p.id} index={i}>
            {i > 0 ? <Divider /> : null}
            <PressableScale onPress={() => router.push(`/ajustes/profesional/${p.id}`)} disabled={!canEdit} accessibilityRole="button" scaleTo={0.985}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, opacity: p.active ? 1 : 0.55 }}>
                <Avatar initials={p.initials} colorKey={p.colorKey} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="subheading">{p.name}</Text>
                  <Text variant="caption" color={colors.textMuted} numberOfLines={2}>
                    {p.serviceIds.map((id) => services.data?.find((s) => s.id === id)?.name).filter(Boolean).join(', ') || 'Sin servicios'}
                  </Text>
                </View>
                {!p.active ? <Badge label="Inactivo" /> : <Badge label={p.hasUserAccess ? 'Con acceso' : 'Sin app'} tone={p.hasUserAccess ? 'success' : 'neutral'} />}
                {canEdit ? <ChevronRight size={18} color={colors.textSubtle} /> : null}
              </View>
            </PressableScale>
          </Appear>
        ))}
      </Card>
    </Screen>
  );
}
