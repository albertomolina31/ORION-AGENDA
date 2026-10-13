import { useQueryClient } from '@tanstack/react-query';
import { CloudOff } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ReduceMotion } from 'react-native-reanimated';
import { useNetwork } from '@/lib/network';
import { Text } from './Text';
import { colors, radius, spacing } from './theme';

/** Aviso persistente sin conexión, con la hora de los datos que se están mostrando (P42). */
export function OfflineBanner() {
  const { online, reason } = useNetwork();
  const qc = useQueryClient();
  if (online) return null;
  const last = Math.max(0, ...qc.getQueryCache().getAll().map((q) => q.state.dataUpdatedAt));
  const when = last
    ? new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', hourCycle: 'h23' }).format(new Date(last))
    : null;
  return (
    <Animated.View
      entering={FadeInUp.duration(220).reduceMotion(ReduceMotion.System)}
      exiting={FadeOutUp.duration(180)}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ marginHorizontal: spacing.lg, marginBottom: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.night }}
    >
      <CloudOff size={16} color={colors.textOnNight} />
      <View style={{ flex: 1 }}>
        <Text variant="captionStrong" color={colors.textOnNight}>
          {reason === 'server' ? 'No hay conexión con el servidor' : 'Sin conexión a internet'}
        </Text>
        <Text variant="micro" color={colors.textOnNightMuted}>
          {when ? `Mostrando datos guardados de ${when}. ` : ''}Agendar, cambiar o canjear se activa al volver la conexión.
        </Text>
      </View>
    </Animated.View>
  );
}
