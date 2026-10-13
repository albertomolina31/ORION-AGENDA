import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { avatarColor, proColor } from './theme';

export function Avatar({
  initials,
  size = 48,
  colorKey,
  seed,
}: {
  initials: string;
  size?: number;
  colorKey?: string;
  seed?: string;
}) {
  const c = colorKey ? proColor(colorKey) : avatarColor(seed ?? initials);
  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.soft }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text variant={size >= 64 ? 'title' : size >= 44 ? 'subheading' : size >= 34 ? 'captionStrong' : 'micro'} color={c.strong}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
});
