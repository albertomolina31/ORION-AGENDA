import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Text, type AppTextProps } from './Text';

/**
 * Capa de movimiento. Todas las animaciones respetan "Reducir movimiento" del sistema
 * (ReduceMotion.System / useReducedMotion) y ninguna transmite información por sí sola.
 */

export const haptic = {
  tap: () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  select: () => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
  },
  success: () => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  warning: () => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
};

/** Entrada escalonada para tarjetas y filas de lista. */
export function Appear({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 45)
        .duration(320)
        .springify()
        .damping(18)
        .reduceMotion(ReduceMotion.System)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** Pressable que se encoge levemente y vibra al tocarse. */
export function PressableScale({
  children,
  style,
  onPress,
  scaleTo = 0.97,
  hapticOnPress = true,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & { children: ReactNode; style?: StyleProp<ViewStyle>; scaleTo?: number; hapticOnPress?: boolean }) {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // El contenedor externo hereda las propiedades de flex para ocupar su espacio en filas.
  const flat = StyleSheet.flatten(style) ?? {};
  const outer: ViewStyle = { flex: flat.flex, flexGrow: flat.flexGrow, flexShrink: flat.flexShrink, flexBasis: flat.flexBasis, alignSelf: flat.alignSelf };
  const inner: ViewStyle = { ...flat, flex: flat.flex !== undefined ? 1 : undefined, flexBasis: undefined, flexGrow: undefined, alignSelf: undefined };
  return (
    <Pressable
      {...rest}
      style={outer}
      onPress={(e) => {
        if (hapticOnPress) haptic.tap();
        onPress?.(e);
      }}
      onPressIn={(e) => {
        if (!reduced) scale.value = withSpring(scaleTo, { damping: 20, stiffness: 400 });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 14, stiffness: 300 });
        rest.onPressOut?.(e);
      }}
    >
      <Animated.View style={[inner, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Número que cuenta hasta su valor (0 → 7). */
export function AnimatedNumber({ value, ...text }: { value: number } & AppTextProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(reduced ? value : 0);
  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    const start = from.current;
    const t0 = Date.now();
    const duration = 650;
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return <Text {...text}>{shown}</Text>;
}

/** Bloque de carga con pulso suave. */
export function Shimmer({ style }: { style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0.55);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!reduced) o.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.55, { duration: 700 })), -1);
  }, [o, reduced]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[style, a]} />;
}

/** Flotación suave en bucle (Ori en reposo). */
export function useFloat(amplitude = 5, duration = 1800) {
  const y = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    y.value = withRepeat(withSequence(withTiming(-amplitude, { duration }), withTiming(0, { duration })), -1);
  }, [y, reduced, amplitude, duration]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
}

/**
 * Sacudida horizontal (como una respuesta incorrecta en Duolingo) para errores de
 * validación. Con movimiento reducido solo vibra.
 */
export function useShake() {
  const x = useSharedValue(0);
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const shake = () => {
    haptic.warning();
    if (reduced) return;
    x.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 60 }),
      withTiming(-6, { duration: 60 }),
      withTiming(6, { duration: 60 }),
      withTiming(0, { duration: 50 }),
    );
  };
  return { style, shake };
}

/** Rebote de "pop" (escala) que se dispara cuando cambia `trigger`. */
export function usePop(trigger: unknown, to = 1.18) {
  const s = useSharedValue(1);
  const reduced = useReducedMotion();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    s.value = withSequence(withTiming(to, { duration: 110 }), withSpring(1, { damping: 8, stiffness: 260 }));
  }, [trigger, reduced, s, to]);
  return useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
}
