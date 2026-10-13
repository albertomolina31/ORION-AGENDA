import type { LucideIcon } from 'lucide-react-native';
import { CalendarDays, House, Megaphone, Store, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { colors, radius, spacing } from './theme';

export const tabIcons: Record<string, LucideIcon> = {
  index: House,
  agenda: CalendarDays,
  clientes: Users,
  marketing: Megaphone,
  negocio: Store,
};

interface TabBarProps {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  descriptors: Record<string, { options: { title?: string; href?: unknown; tabBarItemStyle?: unknown } }>;
  navigation: { navigate: (name: string) => void; emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
}

/** Barra inferior con píldora lavanda en la pestaña activa (mockups). */
export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const visible = state.routes.filter((r) => descriptors[r.key]?.options.href !== null);
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]} accessibilityRole="tablist">
      {visible.map((route) => {
        const focused = state.routes[state.index]?.key === route.key;
        const Icon = tabIcons[route.name] ?? House;
        const label = descriptors[route.key]?.options.title ?? route.name;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={styles.item}
          >
            <View style={[styles.pill, focused && styles.pillActive]}>
              <Icon size={26} color={focused ? colors.primary : colors.textMuted} fill={focused ? colors.primary : 'transparent'} fillOpacity={focused ? 1 : 0} />
            </View>
            <Text variant="captionStrong" color={focused ? colors.primary : colors.textMuted} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  item: { flex: 1, alignItems: 'center', gap: 2, minHeight: 56 },
  pill: { paddingHorizontal: spacing.lg, paddingVertical: 4, borderRadius: radius.pill },
  pillActive: { backgroundColor: colors.primarySoft },
});
