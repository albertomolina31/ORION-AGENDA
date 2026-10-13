import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { endpoints } from '@/lib/endpoints';
import { useBusiness } from '@/lib/session';
import { Avatar, Badge, Card, colors, EmptyState, ErrorState, Screen, SkeletonList, spacing, StackHeader, StampRow, Text } from '@/ui';

export default function Members() {
  const m = useBusiness();
  const q = useQuery({ queryKey: ['loyalty-members', m.businessId], queryFn: () => endpoints.loyaltyMemberships(m.businessId) });
  return (
    <Screen header={<StackHeader title="Miembros" subtitle="Programa de fidelidad" />} onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading ? <SkeletonList rows={4} /> : null}
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}
      {q.data?.length === 0 ? <EmptyState title="Aún no hay miembros" body="La afiliación requiere consentimiento; no se inscribe automáticamente." /> : null}
      <Card padded={false}>
        {q.data?.map((mb, i) => (
          <Pressable
            key={mb.id}
            onPress={() => router.push(`/cliente/${mb.customerId}`)}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
          >
            <Avatar initials={mb.customerName.split(' ').map((w) => w[0]).slice(0, 2).join('')} seed={mb.customerName} size={44} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="subheading">{mb.customerName}</Text>
              <StampRow filled={mb.stamps} total={mb.stampsRequired} size={14} />
            </View>
            {mb.availableRewards.some((r) => r.status === 'AVAILABLE') ? <Badge label="Recompensa" tone="warning" /> : null}
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
