import { Check, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useCustomers } from '@/lib/queries';
import { Avatar, Badge, Card, colors, Divider, haptic, LinkButton, radius, spacing, Text } from '@/ui';

const consentBadge = {
  GRANTED: { label: 'Acepta promociones', tone: 'success' as const },
  NOT_GRANTED: { label: 'Sin consentimiento', tone: 'neutral' as const },
  REVOKED: { label: 'Dado de baja', tone: 'danger' as const },
};

/**
 * Selección manual de destinatarios. Se puede marcar a cualquiera, pero quien no dio
 * consentimiento o se dio de baja queda excluido en la vista previa y en el envío.
 */
export function RecipientPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [limit, setLimit] = useState(15);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const list = useCustomers({ q: debounced || undefined, limit, sort: 'NAME' });
  const toggle = (id: string) => {
    haptic.select();
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md + 2, backgroundColor: colors.surface }}>
        <Search size={18} color={colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar cliente"
          placeholderTextColor={colors.textSubtle}
          style={{ flex: 1, fontSize: 16, color: colors.text, paddingVertical: spacing.sm + 2 }}
          accessibilityLabel="Buscar cliente para la campaña"
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="captionStrong" color={colors.primary}>
          {selected.length} {selected.length === 1 ? 'seleccionado' : 'seleccionados'}
        </Text>
        {selected.length ? <LinkButton label="Quitar todos" chevron={false} onPress={() => onChange([])} /> : null}
      </View>
      <Card padded={false}>
        {(list.data?.items ?? []).map((c, i) => {
          const on = selected.includes(c.id);
          const badge = consentBadge[c.promotionalConsent];
          return (
            <View key={c.id}>
              {i > 0 ? <Divider /> : null}
              <Pressable
                onPress={() => toggle(c.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${c.name}, ${badge.label}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: on ? colors.primary : colors.textSubtle,
                    backgroundColor: on ? colors.primary : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on ? <Check size={14} color={colors.textOnPrimary} strokeWidth={3} /> : null}
                </View>
                <Avatar initials={c.initials} seed={c.name} size={32} />
                <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                  {c.name}
                </Text>
                <Badge label={badge.label} tone={badge.tone} />
              </Pressable>
            </View>
          );
        })}
      </Card>
      {list.data?.nextCursor ? <LinkButton label="Ver más clientes" onPress={() => setLimit(limit + 20)} /> : null}
    </View>
  );
}
