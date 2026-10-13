import { router } from 'expo-router';
import { Bell, ChevronDown, ChevronLeft, FlaskConical } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { type LayoutChangeEvent, Pressable, RefreshControl, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { interpolate, ReduceMotion, ZoomIn, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { useNotifications } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { OfflineBanner } from './OfflineBanner';
import { Text } from './Text';
import { colors, radius, spacing, touchTarget } from './theme';
import { themed } from './theme';

const COLLAPSE_AT = 56;

/**
 * Pantalla con scroll, pull-to-refresh, encabezado fijo y CTA inferior que no tapa
 * la última fila. En pestañas (`tabTitle`), el encabezado muestra el título compacto
 * al desplazarse más allá del título grande.
 */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
  footer,
  header,
  tabTitle,
  contentStyle,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  footer?: ReactNode;
  header?: ReactNode;
  tabTitle?: string;
  contentStyle?: ViewStyle;
}) {
  const [footerHeight, setFooterHeight] = useState(0);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {tabTitle !== undefined ? <AppHeader title={tabTitle} scrollY={scrollY} /> : header}
      <OfflineBanner />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingBottom: footerHeight + spacing.xxl }, contentStyle]}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Animated.ScrollView>
      {footer ? (
        <View style={styles.footer} onLayout={(e: LayoutChangeEvent) => setFooterHeight(e.nativeEvent.layout.height)}>
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/** Encabezado de pestañas: selector de negocio, campana y avatar; título compacto al desplazarse. */
export function AppHeader({ title, scrollY }: { title?: string; scrollY?: SharedValue<number> }) {
  const { membership, me } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const inbox = useNotifications();
  const unread = inbox.data?.unreadCount ?? 0;
  const fallback = useSharedValue(0);
  const y = scrollY ?? fallback;
  useAnimatedReaction(
    () => y.value > COLLAPSE_AT,
    (now, prev) => {
      if (now !== prev) scheduleOnRN(setCollapsed, now);
    },
  );
  const pillStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [COLLAPSE_AT - 30, COLLAPSE_AT], [1, 0], 'clamp') }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [COLLAPSE_AT - 10, COLLAPSE_AT + 10], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(y.value, [COLLAPSE_AT - 10, COLLAPSE_AT + 10], [6, 0], 'clamp') }],
  }));
  const borderStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, 24], [0, 1], 'clamp') }));
  return (
    <View style={styles.appHeader}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Animated.View style={pillStyle} pointerEvents={collapsed ? 'none' : 'auto'}>
          <Pressable
            onPress={() => router.push('/negocios')}
            accessibilityRole="button"
            accessibilityLabel={`Negocio actual: ${membership?.businessName}. Cambiar de negocio`}
            style={styles.businessPill}
          >
            <Text variant="subheading" numberOfLines={1} style={{ flexShrink: 1 }}>
              {membership?.businessName}
            </Text>
            <ChevronDown size={16} color={colors.text} />
          </Pressable>
        </Animated.View>
        {title ? (
          <Animated.View style={[StyleSheet.absoluteFill, { justifyContent: 'center' }, titleStyle]} pointerEvents="none">
            <Text variant="heading" accessibilityElementsHidden={!collapsed}>
              {title}
            </Text>
          </Animated.View>
        ) : null}
      </View>
      <View style={styles.headerActions}>
        <View style={styles.demo} accessibilityLabel="Modo simulación: datos sintéticos">
          <FlaskConical size={12} color={colors.accentInk} />
          <Text variant="micro" color={colors.accentInk}>
            Demo
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/notificaciones')}
          accessibilityRole="button"
          accessibilityLabel={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
          style={styles.iconBtn}
        >
          <Bell size={22} color={colors.text} />
          {unread > 0 ? (
            <Animated.View entering={ZoomIn.springify().reduceMotion(ReduceMotion.System)} style={styles.badge}>
              <Text variant="micro" color={colors.textOnPrimary}>
                {unread > 9 ? '9+' : unread}
              </Text>
            </Animated.View>
          ) : null}
        </Pressable>
        <Pressable onPress={() => router.push('/cuenta')} accessibilityRole="button" accessibilityLabel="Tu cuenta" style={styles.avatarBtn}>
          <Text variant="subheading" color={colors.primary}>
            {me?.user.name.charAt(0) ?? '?'}
          </Text>
        </Pressable>
      </View>
      <Animated.View style={[styles.hairline, borderStyle]} />
    </View>
  );
}

/** Encabezado de pantallas apiladas: atrás, título, subtítulo (negocio) y acción. */
export function StackHeader({ title, subtitle, right, center }: { title: string; subtitle?: string; right?: ReactNode; center?: boolean }) {
  return (
    <View style={styles.stackHeader}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        style={styles.backBtn}
      >
        <ChevronLeft size={24} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1, alignItems: center ? 'center' : 'flex-start' }}>
        <Text variant="heading" accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ minWidth: touchTarget, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function PageTitle({ title, subtitle, trailing }: { title: string; subtitle?: string; trailing?: ReactNode }) {
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <Text variant="display" accessibilityRole="header" style={{ flexShrink: 1 }}>
          {title}
        </Text>
        {trailing}
      </View>
      {subtitle ? (
        <Text variant="body" color={colors.textMuted}>
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
          <RadialGradient id="glow" cx="0.82" cy="0.35" r="0.55">
            <Stop offset="0" stopColor="#8B7BFF" stopOpacity="0.45" />
            <Stop offset="1" stopColor="#8B7BFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#ng)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#glow)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg + 2 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    zIndex: 2,
  },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  businessPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    minHeight: 38,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    maxWidth: '100%',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  iconBtn: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 6,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  avatarBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoftStrong, alignItems: 'center', justifyContent: 'center' },
  stackHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.background },
  backBtn: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  night: { borderRadius: radius.xl, overflow: 'hidden', padding: spacing.lg + 2 },
}));
