import { CircleAlert, CloudOff, FlaskConical, RefreshCw } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ApiError } from '@/lib/api-client';
import { Button } from './Button';
import { Ori } from './Ori';
import { Text } from './Text';
import { colors, radius, spacing } from './theme';

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.primary} size="large" />
      <Text variant="caption" color={colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

/** Esqueleto simple para listas mientras cargan. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View style={{ gap: spacing.md }} accessibilityLabel="Cargando" accessibilityRole="progressbar">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.skeleton} />
      ))}
    </View>
  );
}

export function EmptyState({ title, body, actionLabel, onAction, withOri = true }: { title: string; body?: string; actionLabel?: string; onAction?: () => void; withOri?: boolean }) {
  return (
    <View style={styles.empty}>
      {withOri ? <Ori size={120} /> : null}
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
  const Icon = offline ? CloudOff : CircleAlert;
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Icon size={32} color={offline ? colors.neutral : colors.danger} />
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

/** Marca visible de simulación (sección 25): los datos vienen de adaptadores en memoria. */
export function SimulationBanner() {
  return (
    <View style={styles.sim} accessibilityRole="text">
      <FlaskConical size={14} color={colors.accentInk} />
      <Text variant="micro" color={colors.accentInk}>
        Simulación · datos sintéticos en memoria
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { padding: spacing.xxl, alignItems: 'center', gap: spacing.md },
  skeleton: { height: 88, borderRadius: radius.lg, backgroundColor: colors.primarySoft, opacity: 0.6 },
  empty: { alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  error: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sim: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
});
