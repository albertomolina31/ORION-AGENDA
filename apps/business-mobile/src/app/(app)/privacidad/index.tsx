import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Plus, ShieldCheck } from 'lucide-react-native';
import { View } from 'react-native';
import { ConsentHistory, PendingPolicies, PrivacyRequestRow } from '@/features/privacy';
import { endpoints } from '@/lib/endpoints';
import { useBusiness } from '@/lib/session';
import { useRefreshOnFocus } from '@/lib/use-refresh-on-focus';
import { AnimatedNumber, Appear, Button, Card, colors, EmptyState, ErrorState, Note, Screen, SectionHeader, SkeletonList, spacing, StackHeader, Text } from '@/ui';

/** Privacidad y datos (sección 14): consentimientos, solicitudes de derechos y pendientes legales. */
export default function Privacy() {
  const m = useBusiness();
  const canManage = m.permissions.includes('privacy.manage');
  const q = useQuery({ queryKey: ['privacy', m.businessId], queryFn: () => endpoints.privacyOverview(m.businessId), enabled: canManage });
  useRefreshOnFocus(q.refetch);
  const o = q.data;

  if (!canManage) {
    return (
      <Screen header={<StackHeader title="Privacidad y datos" subtitle={m.businessName} />}>
        <EmptyState pose="shield" title="Sin acceso" body="Las solicitudes de datos las atiende el dueño o la administración del negocio." />
      </Screen>
    );
  }

  return (
    <Screen
      header={<StackHeader title="Privacidad y datos" subtitle={m.businessName} />}
      onRefresh={() => q.refetch()}
      refreshing={q.isRefetching}
      footer={<Button label="Registrar solicitud" icon={Plus} onPress={() => router.push('/privacidad/nueva')} />}
    >
      {q.isLoading ? <SkeletonList rows={4} /> : null}
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}
      {o ? (
        <>
          <Appear>
            <Text variant="heading" accessibilityRole="header">
              Promociones por WhatsApp
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <Stat value={o.consent.granted} label="Aceptan" color={colors.success} />
              <Stat value={o.consent.notGranted} label="Sin permiso" color={colors.neutral} />
              <Stat value={o.consent.revoked} label="Se dieron de baja" color={colors.danger} />
            </View>
            <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
              Solo quienes aceptan reciben campañas. Tener su teléfono o una cita no equivale a permiso.
            </Text>
          </Appear>

          <Appear index={1}>
            <SectionHeader title="Solicitudes abiertas" trailing={<Text variant="captionStrong" color={colors.primary}>{o.openRequests.length}</Text>} />
            {o.openRequests.length === 0 ? (
              <Card style={{ marginTop: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <ShieldCheck size={22} color={colors.success} />
                  <Text variant="body" color={colors.textMuted} style={{ flex: 1 }}>
                    No hay solicitudes pendientes.
                  </Text>
                </View>
              </Card>
            ) : (
              <Card style={{ paddingVertical: 0, marginTop: spacing.sm }}>
                {o.openRequests.map((r, i) => (
                  <PrivacyRequestRow key={r.id} r={r} last={i === o.openRequests.length - 1} />
                ))}
              </Card>
            )}
          </Appear>

          <Appear index={2}>
            <Note
              title="¿Qué es una solicitud?"
              body="Cuando un cliente pide ver, corregir o borrar sus datos, o dejar de recibir promociones, regístralo aquí: queda constancia de qué pidió, por qué canal y qué se le respondió."
            />
          </Appear>

          {o.closedRequests.length > 0 ? (
            <Appear index={3}>
              <SectionHeader title="Atendidas recientemente" />
              <Card style={{ paddingVertical: 0, marginTop: spacing.sm }}>
                {o.closedRequests.map((r, i) => (
                  <PrivacyRequestRow key={r.id} r={r} last={i === o.closedRequests.length - 1} />
                ))}
              </Card>
            </Appear>
          ) : null}

          <Appear index={4}>
            <SectionHeader title="Cambios de consentimiento" />
            <Card style={{ marginTop: spacing.sm }}>
              <ConsentHistory events={o.recentConsentChanges} tz={m.timezone} withCustomer />
            </Card>
          </Appear>

          <Appear index={5}>
            <Card tone="warning">
              <PendingPolicies items={o.pendingPolicies} />
            </Card>
          </Appear>
        </>
      ) : null}
    </Screen>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <Card style={{ flex: 1, gap: 2 }}>
      <AnimatedNumber value={value} variant="title" color={color} />
      <Text variant="caption" color={colors.textMuted}>
        {label}
      </Text>
    </Card>
  );
}
