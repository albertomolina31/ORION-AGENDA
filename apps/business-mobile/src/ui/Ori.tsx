import { Image, type ImageSourcePropType, View } from 'react-native';
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useFloat } from './motion';
import { colors } from './theme';

/**
 * Ori, la mascota. Arte entregado por Alberto (13-oct-2026), una PNG por pose en
 * `assets/ori/ori-<pose>{,@2x,@3x}.png`. Se anima con Reanimated (flotar, aparecer).
 * Pendiente: versión Rive con parpadeo y estados (docs/ori-animacion-y-diseno.md),
 * manteniendo esta misma API.
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
}: {
  pose?: OriPose;
  size?: number;
  /** Flotación suave en reposo. */
  float?: boolean;
  /** Aparecer con rebote al montarse. */
  enter?: boolean;
  /** Ilustración decorativa: se oculta a lectores de pantalla. */
  decorative?: boolean;
}) {
  const floatStyle = useFloat(size > 90 ? 5 : 3);
  return (
    <Animated.View
      entering={enter ? ZoomIn.springify().damping(12).reduceMotion(ReduceMotion.System) : undefined}
      style={[{ width: size, height: size }, float ? floatStyle : null]}
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : LABELS[pose]}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
    >
      <Image source={POSES[pose]} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
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
