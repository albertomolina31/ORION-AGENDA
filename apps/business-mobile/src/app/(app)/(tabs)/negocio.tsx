import { router } from 'expo-router';
import { Bell, CalendarDays, ChevronRight, FileText, Info, Scissors, ShieldCheck, Store, Users, Wallet } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { WhatsAppIcon } from '@/features/WhatsAppIcon';
import { useProfile } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import {
  AppHeader,
  Badge,
  Card,
  colors,
  ErrorState,
  ListRow,
  NightCard,
  PageTitle,
  radius,
  Screen,
  SimulationBanner,
  SkeletonList,
  spacing,
  Text,
} from '@/ui';

/** Negocio: servicios, equipo, horarios, políticas e integraciones (conexión de WhatsApp aquí, no en una pestaña). */
export default function Negocio() {
  const m = useBusiness();
  const profile = useProfile();
  const p = profile.data;
  const wa = p?.integrations.find((i) => i.key === 'WHATSAPP');
  const walletLinked = p?.integrations.some((i) => i.key !== 'WHATSAPP' && i.status === 'CONNECTED');
  const missing = p?.setupChecklist.filter((i) => !i.done) ?? [];

  return (
    <Screen onRefresh={() => profile.refetch()} refreshing={profile.isRefetching}>
      <AppHeader />
      <SimulationBanner />
      <PageTitle title="Negocio" subtitle="Configura cómo funciona tu negocio." />

      <NightCard style={{ paddingVertical: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <View style={styles.storeIcon}>
            <Store size={40} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="heading" color={colors.textOnNight} style={{ fontSize: 24, lineHeight: 30 }} numberOfLines={2}>
              {m.businessName}
            </Text>
            <Text variant="body" color={colors.textOnNightMuted}>
              {m.categoryLabel}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/ajustes/reglas')} accessibilityRole="button" style={styles.profileBtn}>
            <Text variant="captionStrong">Perfil del negocio</Text>
            <ChevronRight size={16} color={colors.text} />
          </Pressable>
        </View>
      </NightCard>

      {profile.isLoading ? <SkeletonList rows={3} /> : null}
      {profile.error ? <ErrorState error={profile.error} onRetry={() => profile.refetch()} /> : null}

      {missing.length > 0 ? (
        <Card tone="warning">
          <Text variant="subheading">Falta configurar para recibir reservas externas</Text>
          {missing.map((i) => (
            <Text key={i.key} variant="caption" color={colors.accentInk}>
              • {i.label}
            </Text>
          ))}
        </Card>
      ) : null}

      <Section title="Operación">
        <ListRow icon={Scissors} title="Servicios" subtitle="Catálogo, duración y precios" onPress={() => router.push('/ajustes/servicios')} />
        <ListRow icon={Users} title="Equipo y permisos" subtitle="Profesionales, acceso y roles" onPress={() => router.push('/ajustes/equipo')} />
        <ListRow icon={CalendarDays} title="Horarios y bloqueos" subtitle="Jornadas, descansos y excepciones" onPress={() => router.push('/ajustes/horarios')} />
        <ListRow icon={FileText} title="Reglas de reserva" subtitle="Confirmación, cambios y cancelaciones" onPress={() => router.push('/ajustes/reglas')} last />
      </Section>

      <Section title="Conexiones">
        <View style={styles.connRow}>
          <View style={[styles.connIcon, { backgroundColor: colors.whatsappSoft }]}>
            <WhatsAppIcon size={30} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="subheading">WhatsApp</Text>
            <Text variant="caption" color={colors.textMuted}>
              Reservas y comunicaciones
            </Text>
          </View>
          {wa ? <Badge label={wa.statusLabel} tone={wa.status === 'CONNECTED' ? 'success' : 'warning'} /> : null}
        </View>
        <ListRow
          icon={Wallet}
          title="Tarjetas digitales"
          subtitle="Apple Wallet y Google Wallet"
          accessory={<Badge label={walletLinked ? 'Vinculado' : 'Por vincular'} tone={walletLinked ? 'success' : 'neutral'} />}
          last
        />
      </Section>

      <Section title="Administración">
        <ListRow icon={Bell} title="Notificaciones" subtitle="Avisos para tu equipo" onPress={() => router.push('/notificaciones')} />
        <ListRow icon={ShieldCheck} title="Privacidad y datos" subtitle="Consentimientos y solicitudes" last />
      </Section>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Info size={18} color={colors.textMuted} />
        <Text variant="caption" color={colors.textMuted}>
          Los ajustes disponibles dependen de tus permisos. La edición llega en la siguiente iteración.
        </Text>
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      <Card style={{ paddingVertical: spacing.xs }}>{children}</Card>
    </View>
  );
}

const styles = StyleSheet.create({
  storeIcon: { width: 80, height: 80, borderRadius: radius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: '#F8DFA9',
  },
  connRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  connIcon: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
