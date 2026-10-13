import Svg, { Path } from 'react-native-svg';
import { colors } from '@/ui/theme';

/** Glifo genérico de chat telefónico para el canal WhatsApp (no es el logotipo oficial). */
export function WhatsAppIcon({ size = 28, color = colors.whatsapp }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path
        d="M16 3C8.8 3 3 8.6 3 15.6c0 2.5.7 4.8 2 6.8L3.4 29l6.8-1.8c1.8 1 3.8 1.5 5.8 1.5 7.2 0 13-5.6 13-12.6S23.2 3 16 3Z"
        fill="none"
        stroke={color}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <Path
        d="M11.6 9.8c-.3-.7-.6-.7-.9-.7h-.8c-.3 0-.7.1-1 .5-.4.4-1.3 1.3-1.3 3.1s1.4 3.6 1.5 3.9c.2.2 2.6 4.1 6.5 5.6 3.2 1.2 3.9 1 4.6.9.7-.1 2.3-.9 2.6-1.8.3-.9.3-1.7.2-1.8-.1-.2-.4-.3-.8-.5l-2.7-1.3c-.4-.1-.6-.2-.9.2-.3.4-1 1.2-1.2 1.5-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3.1-1.9-1.1-1-1.9-2.3-2.1-2.7-.2-.4 0-.6.2-.8l.6-.7c.2-.2.3-.4.4-.7.1-.3.1-.5 0-.7l-1.2-2.9Z"
        fill={color}
      />
    </Svg>
  );
}
