import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { colors } from './theme';

/**
 * Ori, la mascota. Arte entregado por Alberto (13-oct-2026): `assets/ori/ori{,@2x,@3x}.png`,
 * recortado a lienzo cuadrado con fondo transparente. Si `ORI_ART` se deja en null,
 * se dibuja el marcador vectorial de respaldo.
 */
const ORI_ART: ImageSourcePropType | null = require('../../assets/ori/ori.png');

export function Ori({ size = 160, accessibilityLabel = 'Ori, la mascota de Orion' }: { size?: number; accessibilityLabel?: string }) {
  if (ORI_ART) {
    return <Image source={ORI_ART} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel={accessibilityLabel} />;
  }
  return (
    <View style={[styles.wrap, { width: size, height: size }]} accessible accessibilityLabel={`${accessibilityLabel} (marcador provisional)`}>
      <Svg width={size} height={size} viewBox="0 0 160 160">
        {/* Órbita dorada (detrás) */}
        <Ellipse cx="82" cy="88" rx="62" ry="18" stroke={colors.accent} strokeWidth="5" fill="none" transform="rotate(-14 82 88)" opacity={0.9} />
        {/* Cuerpo marfil en forma de estrella suave */}
        <Path
          d="M80 18 C92 18 96 34 104 40 C114 46 132 44 134 58 C136 72 120 78 118 90 C116 104 124 128 108 134 C96 138 90 126 80 126 C70 126 64 138 52 134 C36 128 44 104 42 90 C40 78 24 72 26 58 C28 44 46 46 56 40 C64 34 68 18 80 18 Z"
          fill="#FBF8F2"
          stroke="#E4DDF3"
          strokeWidth="2"
        />
        {/* Visor azul noche */}
        <Path d="M50 70 C50 56 62 50 80 50 C98 50 110 56 110 70 C110 86 98 92 80 92 C62 92 50 86 50 70 Z" fill={colors.nightDeep} />
        {/* Ojos y sonrisa */}
        <Path d="M64 72 C66 66 72 66 74 72" stroke="#8FB4FF" strokeWidth="4" strokeLinecap="round" fill="none" />
        <Path d="M86 72 C88 66 94 66 96 72" stroke="#8FB4FF" strokeWidth="4" strokeLinecap="round" fill="none" />
        <Path d="M76 80 C78 83 82 83 84 80" stroke="#8FB4FF" strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* Manos y pies violetas */}
        <Circle cx="34" cy="98" r="10" fill="#8C7BEA" />
        <Circle cx="126" cy="98" r="10" fill="#8C7BEA" />
        <Ellipse cx="64" cy="138" rx="14" ry="8" fill="#8C7BEA" />
        <Ellipse cx="96" cy="138" rx="14" ry="8" fill="#8C7BEA" />
        {/* Estrella dorada en el pecho */}
        <Path d="M80 100 L84 109 L94 110 L86 116 L89 126 L80 120 L71 126 L74 116 L66 110 L76 109 Z" fill={colors.accent} />
        {/* Órbita dorada (delante) */}
        <Path d="M22 100 C44 116 120 104 142 74" stroke={colors.accent} strokeWidth="5" fill="none" strokeLinecap="round" />
        <Circle cx="22" cy="100" r="6" fill={colors.accent} />
      </Svg>
    </View>
  );
}

/** Destellos decorativos dorados (no transmiten información). */
export function Sparkle({ size = 16, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M10 0 C11 6 14 9 20 10 C14 11 11 14 10 20 C9 14 6 11 0 10 C6 9 9 6 10 0 Z" fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
