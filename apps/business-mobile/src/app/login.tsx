import type { DevUser } from '@orion/contracts';
import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { ChevronRight, FlaskConical } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/lib/api-client';
import { API_URL } from '@/lib/config';
import { endpoints } from '@/lib/endpoints';
import { useSession } from '@/lib/session';
import { Avatar, Card, colors, ErrorState, Note, Ori, radius, spacing, Text } from '@/ui';

/**
 * UI01 en modo SIMULADO: selector de usuarios sintéticos.
 * La estrategia real de identidad (email/contraseña, invitación, recuperación) está
 * pendiente de decidir (sección 14); esta pantalla se sustituirá entonces.
 */
export default function Login() {
  const { status, signIn } = useSession();
  const users = useQuery({ queryKey: ['dev-users'], queryFn: endpoints.devUsers });
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status === 'signedIn') return <Redirect href="/" />;

  const enter = async (u: DevUser) => {
    setPending(u.id);
    setError(null);
    try {
      await signIn(u.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo iniciar sesión.');
    } finally {
      setPending(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Ori size={140} />
          <Text variant="display" align="center">
            Orion Business
          </Text>
          <Text variant="body" color={colors.textMuted} align="center">
            Tu agenda, en órbita.
          </Text>
        </View>

        <Note
          icon={FlaskConical}
          tone="warning"
          title="Acceso simulado"
          body="Elige un usuario de prueba. No hay contraseñas ni datos reales: todo vive en memoria y se reinicia con el servidor."
        />

        {users.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {users.error ? <ErrorState error={users.error} onRetry={() => users.refetch()} /> : null}
        {users.data ? (
          <Card padded={false}>
            {users.data.map((u, i) => (
              <Pressable
                key={u.id}
                onPress={() => enter(u)}
                disabled={!!pending}
                accessibilityRole="button"
                accessibilityLabel={`Entrar como ${u.name}, ${u.description}`}
                style={({ pressed }) => [styles.user, i > 0 && styles.divider, pressed && { backgroundColor: colors.surfaceMuted }]}
              >
                <Avatar initials={u.name.charAt(0)} seed={u.name} size={48} />
                <View style={{ flex: 1 }}>
                  <Text variant="subheading">{u.name}</Text>
                  <Text variant="caption" color={colors.textMuted}>
                    {u.description}
                  </Text>
                </View>
                {pending === u.id ? <ActivityIndicator color={colors.primary} /> : <ChevronRight size={22} color={colors.text} />}
              </Pressable>
            ))}
          </Card>
        ) : null}
        {error ? (
          <Text variant="caption" color={colors.danger} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Text variant="micro" color={colors.textSubtle} align="center">
          API: {API_URL}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.xl, gap: spacing.xl, justifyContent: 'center', maxWidth: 520, width: '100%', alignSelf: 'center' },
  user: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
});
