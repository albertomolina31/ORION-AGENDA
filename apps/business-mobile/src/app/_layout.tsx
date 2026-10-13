import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppearanceProvider, useAppearance } from '@/lib/appearance';
import { SessionProvider } from '@/lib/session';
import { colors, FeedbackProvider } from '@/ui';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // Si la fuente falla, seguimos con la del sistema en lugar de bloquear la app.
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return (
    <SafeAreaProvider>
      <AppearanceProvider>
        <SessionProvider>
          <FeedbackProvider>
            <ThemedStack />
          </FeedbackProvider>
        </SessionProvider>
      </AppearanceProvider>
    </SafeAreaProvider>
  );
}

/** El navegador se vuelve a montar al cambiar de tema para recalcular los estilos. */
function ThemedStack() {
  const { scheme } = useAppearance();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack key={scheme} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }} />
    </>
  );
}
