import { Redirect, Stack } from 'expo-router';
import { useSession } from '@/lib/session';
import { colors, LoadingState } from '@/ui';

/** Rutas protegidas: requieren sesión y un negocio autorizado. */
export default function AppLayout() {
  const { status, membership } = useSession();
  if (status === 'loading') return <LoadingState label="Abriendo tu agenda…" />;
  if (status === 'signedOut') return <Redirect href="/login" />;
  if (!membership) return <Redirect href="/negocios" />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="bloqueo" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
