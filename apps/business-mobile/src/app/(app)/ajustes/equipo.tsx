import { View } from 'react-native';
import { useProfessionals, useServices } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { Avatar, Badge, Card, colors, Divider, ErrorState, Note, Screen, SkeletonList, spacing, StackHeader, Text } from '@/ui';

/** UI13 Equipo (lectura). Un profesional puede existir sin usuario de acceso. */
export default function Team() {
  const m = useBusiness();
  const pros = useProfessionals();
  const services = useServices();
  return (
    <Screen header={<StackHeader title="Equipo y permisos" subtitle={m.businessName} />}>
      <Note body="Invitaciones y cambios de rol llegan con P18. No es necesario que cada profesional instale la app para asignarle citas." />
      {pros.isLoading ? <SkeletonList rows={3} /> : null}
      {pros.error ? <ErrorState error={pros.error} onRetry={() => pros.refetch()} /> : null}
      <Card padded={false}>
        {pros.data?.map((p, i) => (
          <View key={p.id}>
            {i > 0 ? <Divider /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg }}>
              <Avatar initials={p.initials} colorKey={p.colorKey} size={40} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="subheading">{p.name}</Text>
                <Text variant="caption" color={colors.textMuted}>
                  {p.serviceIds.map((id) => services.data?.find((s) => s.id === id)?.name).filter(Boolean).join(', ')}
                </Text>
              </View>
              <Badge label={p.hasUserAccess ? 'Con acceso' : 'Sin acceso a la app'} tone={p.hasUserAccess ? 'success' : 'neutral'} />
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
