import { Image, type ImageSourcePropType, Pressable, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useEffect } from 'react';
import { haptic } from './motion';
import { colors } from './theme';

/**
 * Ori, la mascota. Arte entregado por Alberto (13-oct-2026), una PNG por pose en
 * `assets/ori/ori-<pose>{,@2x,@3x}.png`.
 *
 * Animación tipo Duolingo con Reanimated (mientras llega la versión Rive, ver
 * docs/ori-animacion-y-diseno.md): respira y flota en reposo, salta con "squash &
 * stretch" al tocarlo y aparece con rebote al cambiar de pose. Con "Reducir
 * movimiento" queda estático.
 */
const POSES = {
  wave: require('../../assets/ori/ori-wave.png'),
  point: require('../../assets/ori/ori-point.png'),
  star: require('../../assets/ori/ori-star.png'),
  celebrate: require('../../assets/ori/ori-celebrate.png'),
  head: require('../../assets/ori/ori-head.png'),
  unplugged: require('../../assets/ori/ori-unplugged.png'),
  sleep: require('../../assets/ori/ori-sleep.png'),
  calendar: require('../../assets/ori/ori-calendar.png'),
  whatsapp: require('../../assets/ori/ori-whatsapp.png'),
  shield: require('../../assets/ori/ori-shield.png'),
  think: require('../../assets/ori/ori-think.png'),
  search: require('../../assets/ori/ori-search.png'),
} satisfies Record<string, ImageSourcePropType>;

export type OriPose = keyof typeof POSES;

const LABELS: Record<OriPose, string> = {
  wave: 'Ori saluda',
  point: 'Ori señala un consejo',
  star: 'Ori abraza una estrella',
  celebrate: 'Ori celebra',
  head: 'Ori',
  unplugged: 'Ori sostiene un cable desconectado',
  sleep: 'Ori duerme',
  calendar: 'Ori muestra un calendario',
  whatsapp: 'Ori junto a un chat',
  shield: 'Ori con un escudo',
  think: 'Ori pensando',
  search: 'Ori busca con una lupa',
};

export function Ori({
  pose = 'wave',
  size = 120,
  float = true,
  enter = true,
  decorative = true,
  interactive = true,
  jump,
}: {
  pose?: OriPose;
  size?: number;
  /** Respiración y flotación suaves en reposo. */
  float?: boolean;
  /** Aparecer con rebote al montarse o al cambiar de pose. */
  enter?: boolean;
  /** Ilustración decorativa: se oculta a lectores de pantalla. */
  decorative?: boolean;
  /** Tocar a Ori lo hace saltar (detalle lúdico, no ejecuta acciones). */
  interactive?: boolean;
  /** Cambiar este valor dispara un salto de celebración. */
  jump?: unknown;
}) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  const breathe = useSharedValue(1);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const hop = useSharedValue(0);

  useEffect(() => {
    if (reduced || !float) return;
    const amp = size > 90 ? 5 : 3;
    y.value = withRepeat(withSequence(withTiming(-amp, { duration: 1700 }), withTiming(0, { duration: 1700 })), -1);
    breathe.value = withRepeat(withSequence(withTiming(1.025, { duration: 1300 }), withTiming(1, { duration: 1300 })), -1);
  }, [reduced, float, size, y, breathe]);

  const squashAndJump = () => {
    if (reduced) return;
    // Agacharse (squash), estirarse en el aire (stretch) y aterrizar con rebote.
    sx.value = withSequence(withTiming(1.14, { duration: 90 }), withTiming(0.92, { duration: 140 }), withSpring(1, { damping: 7, stiffness: 240 }));
    sy.value = withSequence(withTiming(0.86, { duration: 90 }), withTiming(1.1, { duration: 140 }), withSpring(1, { damping: 7, stiffness: 240 }));
    hop.value = withSequence(withTiming(0, { duration: 90 }), withTiming(-size * 0.18, { duration: 180 }), withSpring(0, { damping: 9, stiffness: 220 }));
  };

  useEffect(() => {
    if (jump !== undefined) squashAndJump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump]);

  const body = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value + hop.value },
      { scaleX: sx.value * breathe.value },
      { scaleY: sy.value * (2 - breathe.value) },
    ],
  }));

  const image = (
    <Animated.View key={pose} entering={enter ? ZoomIn.springify().damping(11).reduceMotion(ReduceMotion.System) : undefined}>
      <Image source={POSES[pose]} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );

  return (
    <View
      style={{ width: size, height: size }}
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : LABELS[pose]}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
    >
      <Animated.View style={[{ width: size, height: size, transformOrigin: 'bottom' }, body]}>
        {interactive ? (
          <Pressable
            onPress={() => {
              haptic.tap();
              squashAndJump();
            }}
            accessible={false}
          >
            {image}
          </Pressable>
        ) : (
          image
        )}
      </Animated.View>
    </View>
  );
}

/** Destello decorativo dorado. */
export function Sparkle({ size = 16, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Path d="M10 0 C11 6 14 9 20 10 C14 11 11 14 10 20 C9 14 6 11 0 10 C6 9 9 6 10 0 Z" fill={color} />
      </Svg>
    </View>
  );
}
