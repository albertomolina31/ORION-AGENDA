import { RefreshCw } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { ApiError } from '@/lib/api-client';
import { Button } from './Button';
import { Shimmer } from './motion';
import { Ori, type OriPose } from './Ori';
import { Text } from './Text';
import { colors, radius, spacing } from './theme';

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite" accessibilityLabel={label}>
      <Ori pose="think" size={96} />
      <Text variant="caption" color={colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

/** Esqueleto con pulso suave mientras cargan las listas. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View style={{ gap: spacing.sm }} accessibilityLabel="Cargando" accessibilityRole="progressbar">
      {Array.from({ length: rows }).map((_, i) => (
        <Shimmer key={i} style={styles.skeleton} />
      ))}
    </View>
  );
}

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  pose = 'sleep',
  withOri = true,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  pose?: OriPose;
  withOri?: boolean;
}) {
  return (
    <View style={styles.empty}>
      {withOri ? <Ori pose={pose} size={112} /> : null}
      <Text variant="heading" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="body" color={colors.textMuted} align="center">
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" compact /> : null}
    </View>
  );
}

/** Error recuperable: explica qué pasó y permite reintentar sin perder contexto. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = error instanceof ApiError ? error : null;
  const offline = e?.code === 'NETWORK' || e?.code === 'TIMEOUT';
  const forbidden = e?.code === 'FORBIDDEN';
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Ori pose={forbidden ? 'shield' : 'unplugged'} size={96} />
      <Text variant="subheading" align="center">
        {offline ? 'Sin conexión con el servidor' : forbidden ? 'No tienes acceso a esta información' : 'No pudimos cargar la información'}
      </Text>
      <Text variant="caption" color={colors.textMuted} align="center">
        {offline ? 'Revisa tu conexión. No se muestran datos nuevos.' : (e?.message ?? 'Intenta de nuevo en un momento.')}
      </Text>
      {onRetry && !forbidden ? <Button label="Reintentar" icon={RefreshCw} onPress={onRetry} variant="outline" compact /> : null}
    </View>
  );
}

/** Se mantiene por compatibilidad: el aviso de simulación vive ahora en el encabezado ("Demo"). */
export function SimulationBanner() {
  return null;
}

const styles = StyleSheet.create({
  center: { padding: spacing.xxl, alignItems: 'center', gap: spacing.sm, flex: 1, justifyContent: 'center', backgroundColor: colors.background },
  skeleton: { height: 68, borderRadius: radius.lg, backgroundColor: colors.primarySoft },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg, paddingHorizontal: spacing.xl },
  error: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
