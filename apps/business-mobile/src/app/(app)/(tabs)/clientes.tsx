import type { CustomerSegment } from '@orion/contracts';
import { router } from 'expo-router';
import { ArrowUpDown, CalendarDays, ChevronRight, LayoutGrid, Lightbulb, Plus, Search, UserPlus, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { CustomerCard } from '@/features/CustomerCard';
import { useCustomers, useHome } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { useRefreshOnFocus } from '@/lib/use-refresh-on-focus';
import {
  Appear,
  Button,
  colors,
  EmptyState,
  ErrorState,
  LinkButton,
  Note,
  PageTitle,
  radius,
  Screen,
  SkeletonList,
  spacing,
  Text,
} from '@/ui';

const PAGE = 5;
const SORTS = ['NAME', 'NEXT_APPOINTMENT', 'LAST_VISIT'] as const;
const sortLabel = { NAME: 'Nombre', NEXT_APPOINTMENT: 'Próxima cita', LAST_VISIT: 'Última visita' } as const;

/** UI10 Clientes/Pacientes: búsqueda, segmentos y directorio paginado. */
export default function Clientes() {
  const m = useBusiness();
  const home = useHome();
  const today = home.data?.date ?? '';
  const [segment, setSegment] = useState<CustomerSegment>('ALL');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sort, setSort] = useState<(typeof SORTS)[number]>('NAME');
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setLimit(PAGE), [segment, debounced, sort]);

  const list = useCustomers({ segment, q: debounced || undefined, sort, limit });
  useRefreshOnFocus(list.refetch);
  const plural = m.vocabulary.customerPlural;
  const singular = m.vocabulary.customerSingular.toLowerCase();
  const counts = list.data?.segmentCounts;
  const isProfessional = m.role === 'PROFESSIONAL';

  const segments: Array<{ key: CustomerSegment; label: string; icon: typeof Users }> = [
    { key: 'FIRST_VISIT', label: 'Primera visita', icon: UserPlus },
    { key: 'REGULARS', label: 'Habituales', icon: Users },
    { key: 'NO_UPCOMING', label: 'Sin próxima cita', icon: CalendarDays },
    { key: 'ALL', label: 'Todos', icon: LayoutGrid },
  ];
  const title = {
    ALL: `Todos los ${plural.toLowerCase()}`,
    FIRST_VISIT: 'Primera visita',
    REGULARS: 'Habituales',
    NO_UPCOMING: 'Sin próxima cita',
    WITH_UPCOMING: 'Con cita',
  }[segment];

  return (
    <Screen
      tabTitle={isProfessional ? `Mis ${plural.toLowerCase()}` : plural}
      onRefresh={() => list.refetch()}
      refreshing={list.isRefetching}
      footer={m.permissions.includes('customers.manage') ? <Button label={`Nuevo ${singular}`} icon={Plus} onPress={() => router.push('/cliente/nuevo')} /> : undefined}
    >
      <PageTitle
        title={isProfessional ? `Mis ${plural.toLowerCase()}` : plural}
        subtitle={`Conoce a tus ${plural.toLowerCase()}. Cuida cada visita.`}
        trailing={
          counts ? (
            <View style={styles.countPill}>
              <Text variant="subheading" color={colors.primary}>
                {counts.ALL}
              </Text>
            </View>
          ) : null
        }
      />

      <View style={styles.search}>
        <Search size={20} color={colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar por nombre o teléfono"
          placeholderTextColor={colors.textSubtle}
          style={styles.searchInput}
          accessibilityLabel={`Buscar ${plural.toLowerCase()}`}
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>

      <View style={styles.grid}>
        {segments.map((s) => {
          const active = segment === s.key;
          const Icon = s.icon;
          return (
            <Pressable
              key={s.key}
              onPress={() => setSegment(s.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${s.label}${counts ? `, ${counts[s.key]}` : ''}`}
              style={[styles.segCard, active && styles.segActive]}
            >
              <View style={styles.segIcon}>
                <Icon size={18} color={colors.primary} />
              </View>
              <Text variant="captionStrong" color={active ? colors.primary : colors.text} style={{ flex: 1 }}>
                {s.label}
              </Text>
              <ChevronRight size={16} color={colors.textSubtle} />
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: spacing.md }}>
        <View style={styles.listHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 }}>
            <Text variant="heading" accessibilityRole="header">
              {title}
            </Text>
            {list.data && segment !== 'ALL' ? (
              <View style={styles.smallCount}>
                <Text variant="bodyStrong" color={colors.primary}>
                  {list.data.total}
                </Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={() => setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length]!)}
            accessibilityRole="button"
            accessibilityLabel={`Ordenar por ${sortLabel[sort]}. Cambiar orden`}
            style={styles.sort}
          >
            <Text variant="bodyStrong" color={colors.primary}>
              {sortLabel[sort]}
            </Text>
            <ArrowUpDown size={18} color={colors.primary} />
          </Pressable>
        </View>
        {segment === 'FIRST_VISIT' ? (
          <Text variant="body" color={colors.textMuted}>
            Próximas citas de {plural.toLowerCase()} que aún no has atendido.
          </Text>
        ) : null}

        {list.isLoading ? <SkeletonList rows={4} /> : null}
        {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : null}
        {list.data?.items.length === 0 ? (
          <EmptyState
            pose={debounced ? 'search' : 'sleep'}
            title={debounced ? 'Sin resultados' : 'Nadie en este grupo por ahora'}
            body={debounced ? `No encontramos "${debounced}". Revisa la ortografía o busca por teléfono.` : undefined}
          />
        ) : null}
        {list.data?.items.map((c, i) => (
          <Appear key={c.id} index={i}>
          <CustomerCard customer={c} tz={m.timezone} today={today} variant={segment === 'FIRST_VISIT' ? 'firstVisit' : 'directory'} />
          </Appear>
        ))}
        {list.data && list.data.items.length > 0 ? (
          <View style={styles.pager}>
            <Text variant="body" color={colors.textMuted}>
              Mostrando {list.data.items.length} de {list.data.total}
            </Text>
            {list.data.nextCursor ? <LinkButton label="Ver más" onPress={() => setLimit(limit + PAGE * 2)} /> : null}
          </View>
        ) : null}
        {segment === 'FIRST_VISIT' && (list.data?.total ?? 0) > 0 ? (
          <Note icon={Lightbulb} title="Un buen comienzo importa" body="Revisa sus preferencias antes de recibirlos." />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  countPill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  smallCount: { paddingHorizontal: spacing.md, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 46,
    borderRadius: radius.md + 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  segCard: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    minHeight: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  segActive: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
  segIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  sort: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
