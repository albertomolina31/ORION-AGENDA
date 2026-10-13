import { Star } from 'lucide-react-native';
import { View } from 'react-native';
import { colors } from './theme';

/** Contador de fidelidad: muestra el resultado del módulo de Sergio, nunca lo calcula. */
export function StampRow({ filled, total, size = 26, onDark }: { filled: number; total: number; size?: number; onDark?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: size * 0.3, flexWrap: 'wrap' }} accessible accessibilityLabel={`${filled} de ${total} sellos`}>
      {Array.from({ length: total }).map((_, i) =>
        i < filled ? (
          <View
            key={i}
            style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}
          >
            {size >= 30 ? <Star size={size * 0.55} color="#B8740F" fill="#F7C35A" /> : null}
          </View>
        ) : (
          <View
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 2,
              borderStyle: onDark ? 'dashed' : 'solid',
              borderColor: onDark ? '#B7B3E6' : colors.border,
            }}
          />
        ),
      )}
    </View>
  );
}
