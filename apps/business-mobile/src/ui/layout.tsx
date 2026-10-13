import { router } from 'expo-router';
import { Bell, ChevronDown, ChevronLeft } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { type LayoutChangeEvent, Pressable, RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSession } from '@/lib/session';
import { SimulationBanner } from './states';
import { Text } from './Text';
import { colors, radius, spacing, touchTarget } from './theme';

/** Pantalla con scroll, pull-to-refresh y margen para la barra inferior/CTA fija. */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
  footer,
  header,
  contentStyle,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Acción principal fija (no cubre la última fila: se reserva espacio). */
  footer?: ReactNode;
  header?: ReactNode;
  contentStyle?: ViewStyle;
}) {
  const [footerHeight, setFooterHeight] = useState(0);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: footerHeight + spacing.xxl }, contentStyle]}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? (
        <View style={styles.footer} onLayout={(e: LayoutChangeEvent) => setFooterHeight(e.nativeEvent.layout.height)}>
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/** Encabezado de pestañas: selector de negocio, campana y avatar personal. */
export function AppHeader() {
  const { membership, me } = useSession();
  const multi = (me?.memberships.length ?? 0) > 1;
  return (
    <View style={styles.appHeader}>
      <Pressable
        onPress={() => router.push('/negocios')}
        accessibilityRole="button"
        accessibilityLabel={`Negocio actual: ${membership?.businessName}. ${multi ? 'Cambiar de negocio' : ''}`}
        style={styles.businessPill}
      >
        <Text variant="subheading" numberOfLines={1} style={{ flexShrink: 1 }}>
          {membership?.businessName}
        </Text>
        <ChevronDown size={20} color={colors.text} />
      </Pressable>
      <View style={styles.headerActions}>
        <Pressable onPress={() => router.push('/notificaciones')} accessibilityRole="button" accessibilityLabel="Notificaciones" style={styles.iconBtn}>
          <Bell size={26} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push('/cuenta')} accessibilityRole="button" accessibilityLabel="Tu cuenta" style={styles.avatarBtn}>
          <Text variant="heading" color={colors.primary}>
            {me?.user.name.charAt(0) ?? '?'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Encabezado de pantallas apiladas: atrás, título, subtítulo (negocio) y acción. */
export function StackHeader({ title, subtitle, right, center }: { title: string; subtitle?: string; right?: ReactNode; center?: boolean }) {
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
      <View style={styles.stackHeader}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={styles.iconBtn}
        >
          <ChevronLeft size={30} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: center ? 'center' : 'flex-start' }}>
          <Text variant="title" accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body" color={colors.textMuted} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={{ minWidth: touchTarget, alignItems: 'flex-end' }}>{right}</View>
      </View>
      <SimulationBanner />
    </SafeAreaView>
  );
}

export function PageTitle({ title, subtitle, trailing }: { title: string; subtitle?: string; trailing?: ReactNode }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <Text variant="display" accessibilityRole="header" style={{ fontSize: 40, lineHeight: 46, flexShrink: 1 }}>
          {title}
        </Text>
        {trailing}
      </View>
      {subtitle ? (
        <Text variant="body" color={colors.textMuted} style={{ fontSize: 18, lineHeight: 24 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** Tarjeta azul noche con degradado violeta (hero de Inicio, Marketing, Negocio). */
export function NightCard({ children, style, minHeight }: { children: ReactNode; style?: ViewStyle; minHeight?: number }) {
  return (
    <View style={[styles.night, minHeight ? { minHeight } : null, style]}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="ng" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.nightDeep} />
            <Stop offset="0.55" stopColor={colors.night} />
            <Stop offset="1" stopColor={colors.nightGlow} />
          </LinearGradient>
          <RadialGradient id="glow" cx="0.8" cy="0.4" r="0.6">
            <Stop offset="0" stopColor="#7B6BFF" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#7B6BFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#ng)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#glow)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg + 4, paddingTop: spacing.sm, gap: spacing.xl },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg + 4,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  appHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingTop: spacing.sm },
  businessPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoftStrong,
    flexShrink: 1,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBtn: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  avatarBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoftStrong, alignItems: 'center', justifyContent: 'center' },
  stackHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  night: { borderRadius: radius.xl, overflow: 'hidden', padding: spacing.xl },
});
