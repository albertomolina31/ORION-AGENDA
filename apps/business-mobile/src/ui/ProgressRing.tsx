import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';
import { Sparkle } from './Ori';
import Svg, { Circle } from 'react-native-svg';
import { Text } from './Text';
import { colors } from './theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Anillo de progreso animado (p. ej. citas atendidas del día). */
export function ProgressRing({
  value,
  total,
  size = 88,
  stroke = 9,
  label,
  onDark,
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
  label?: string;
  onDark?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? Math.min(1, value / total) : 0;
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? ratio : 0);
  useEffect(() => {
    p.value = reduced ? ratio : withTiming(ratio, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [ratio, reduced, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  // Al completar la meta: latido y destellos (como al terminar una lección).
  const complete = total > 0 && value >= total;
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (complete && !reduced) pulse.value = withDelay(900, withSequence(withTiming(1.12, { duration: 160 }), withSpring(1, { damping: 6, stiffness: 220 })));
  }, [complete, reduced, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  return (
    <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, pulseStyle]} accessible accessibilityLabel={`${value} de ${total}${label ? ` ${label}` : ''}${complete ? ', meta completada' : ''}`}>
      {complete
        ? [
            { top: -4, left: size / 2 - 8, d: 950 },
            { top: size / 2 - 8, left: -6, d: 1050 },
            { top: size / 2 - 8, right: -6, d: 1100 },
            { bottom: -4, left: size / 2 - 8, d: 1000 },
          ].map(({ d, ...pos }, i) => (
            <Animated.View key={i} entering={ZoomIn.delay(d).springify().damping(8).reduceMotion(ReduceMotion.System)} style={{ position: 'absolute', ...pos }}>
              <Sparkle size={16} />
            </Animated.View>
          ))
        : null}
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={onDark ? 'rgba(255,255,255,0.14)' : colors.primarySoft} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          animatedProps={props}
        />
      </Svg>
      <Text variant="title" color={onDark ? colors.textOnNight : colors.text}>
        {value}
        <Text variant="caption" color={onDark ? colors.textOnNightMuted : colors.textMuted}>
          /{total}
        </Text>
      </Text>
    </Animated.View>
  );
}
