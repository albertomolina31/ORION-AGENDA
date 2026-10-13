import { Redirect, router } from 'expo-router';
import { Check, ChevronRight, Store } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSession } from '@/lib/session';
import { Card, colors, EmptyState, IconCircle, Screen, spacing, StackHeader, Text } from '@/ui';

/** UI02: negocios autorizados; cada selección revalida la membresía con el servidor. */
export default function Negocios() {
  const { status, me, membership, selectBusiness, signOut } = useSession();
  const [pending, setPending] = useState<string | null>(null);
  if (status === 'signedOut') return <Redirect href="/login" />;
  if (!me) return null;

  return (
    <Screen header={<StackHeader title="Tus negocios" subtitle="Elige dónde trabajar" />}>
      {me.memberships.length === 0 ? (
        <EmptyState
          title="Aún no tienes acceso a un negocio"
          body="Pide una invitación al dueño o crea tu negocio cuando el alta guiada esté disponible."
          actionLabel="Cerrar sesión"
          onAction={signOut}
        />
      ) : (
        <Card padded={false}>
          {me.memberships.map((m, i) => (
            <Pressable
              key={m.businessId}
              accessibilityRole="button"
              accessibilityState={{ selected: m.businessId === membership?.businessId }}
              onPress={async () => {
                setPending(m.businessId);
                try {
                  await selectBusiness(m.businessId);
                  router.replace('/');
                } finally {
                  setPending(null);
                }
              }}
              style={[styles.row, i > 0 && styles.divider]}
            >
              <IconCircle icon={Store} square size={52} />
              <View style={{ flex: 1 }}>
                <Text variant="subheading">{m.businessName}</Text>
                <Text variant="caption" color={colors.textMuted}>
                  {m.categoryLabel} · {m.roleLabel}
                </Text>
              </View>
              {pending === m.businessId ? (
                <ActivityIndicator color={colors.primary} />
              ) : m.businessId === membership?.businessId ? (
                <Check size={22} color={colors.primary} />
              ) : (
                <ChevronRight size={22} color={colors.text} />
              )}
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
});
