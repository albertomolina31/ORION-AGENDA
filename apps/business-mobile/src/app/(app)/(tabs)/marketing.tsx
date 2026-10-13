import type { Campaign } from '@orion/contracts';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CalendarDays, ChevronRight, CircleCheck, FileText, Gift, History, Megaphone, Plus, ScanLine, Send, ShieldCheck, Star, Target, Users, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { WhatsAppIcon } from '@/features/WhatsAppIcon';
import { endpoints } from '@/lib/endpoints';
import { fmt } from '@/lib/format';
import { useBusiness } from '@/lib/session';
import { useRefreshOnFocus } from '@/lib/use-refresh-on-focus';
import {
  AppHeader,
  Badge,
  Button,
  CampaignBadge,
  Card,
  colors,
  Divider,
  EmptyState,
  ErrorState,
  IconCircle,
  LinkButton,
  NightCard,
  Note,
  Ori,
  PageTitle,
  radius,
  Screen,
  SectionHeader,
  SegmentedControl,
  SimulationBanner,
  SkeletonList,
  spacing,
  Sparkle,
  StampRow,
  Text,
} from '@/ui';

/** UI20 Marketing: Campañas y Fidelidad, según funciones habilitadas y permisos. */
export default function Marketing() {
  const m = useBusiness();
  const canCampaigns = m.features.campaigns;
  const canLoyalty = m.features.loyalty;
  const [tab, setTab] = useState<'campaigns' | 'loyalty'>(canCampaigns ? 'campaigns' : 'loyalty');

  if (!canCampaigns && !canLoyalty) {
    return (
      <Screen>
        <AppHeader />
        <EmptyState title="Marketing no está habilitado" body="Pide al dueño del negocio que active fidelidad o campañas para tu rol." />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader />
      <SimulationBanner />
      <PageTitle title="Marketing" subtitle="Haz que tus clientes vuelvan." />
      {canCampaigns && canLoyalty ? (
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'campaigns', label: 'Campañas', icon: Megaphone },
            { value: 'loyalty', label: 'Fidelidad', icon: Star },
          ]}
        />
      ) : null}
      {tab === 'campaigns' ? <CampaignsTab onOpenLoyalty={canLoyalty ? () => setTab('loyalty') : undefined} /> : <LoyaltyTab />}
    </Screen>
  );
}

function CampaignsTab({ onOpenLoyalty }: { onOpenLoyalty?: () => void }) {
  const m = useBusiness();
  const campaigns = useQuery({ queryKey: ['campaigns', m.businessId], queryFn: () => endpoints.campaigns(m.businessId) });
  useRefreshOnFocus(campaigns.refetch);
  const canManage = m.permissions.includes('campaigns.manage');
  return (
    <>
      <NightCard minHeight={170}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Text variant="title" color={colors.textOnNight} style={{ fontSize: 30, lineHeight: 34 }}>
              Conecta por WhatsApp
            </Text>
            <Text variant="body" color={colors.textOnNightMuted} style={{ fontSize: 18 }}>
              Crea campañas para quienes quieren recibirlas.
            </Text>
          </View>
          <View style={styles.waBubble}>
            <View style={{ position: 'absolute', top: -10, left: -14 }}>
              <Sparkle size={22} />
            </View>
            <WhatsAppIcon size={60} />
          </View>
        </View>
      </NightCard>
      {canManage ? <Button label="Crear campaña" icon={Plus} onPress={() => router.push('/campana/nueva')} /> : null}
      <Note icon={ShieldCheck} tone="warning" body="Solo clientes con consentimiento promocional" />

      <View style={{ gap: spacing.md }}>
        <SectionHeader title="Tus campañas" />
        {campaigns.isLoading ? <SkeletonList rows={3} /> : null}
        {campaigns.error ? <ErrorState error={campaigns.error} onRetry={() => campaigns.refetch()} /> : null}
        {campaigns.data?.length === 0 ? <EmptyState title="Aún no hay campañas" body="Crea la primera para invitar a tus clientes a volver." /> : null}
        {campaigns.data?.map((c) => <CampaignCard key={c.id} c={c} tz={m.timezone} />)}
      </View>

      {onOpenLoyalty ? (
        <Card tone="warning" onPress={onOpenLoyalty}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <IconCircle icon={Star} tone="warning" size={60} />
            <View style={{ flex: 1 }}>
              <Text variant="subheading">Tu programa de fidelidad</Text>
              <Text variant="caption" color={colors.textMuted}>
                Sellos, tarjetas y recompensas
              </Text>
            </View>
            <Text variant="bodyStrong" color={colors.primary}>
              Gestionar
            </Text>
            <ChevronRight size={20} color={colors.primary} />
          </View>
        </Card>
      ) : null}
    </>
  );
}

function CampaignCard({ c, tz }: { c: Campaign; tz: string }) {
  const icon = c.status === 'DRAFT' ? FileText : c.objective === 'THANK_YOU' ? Gift : Megaphone;
  return (
    <Card onPress={() => router.push(c.status === 'DRAFT' ? `/campana/nueva?id=${c.id}` : `/campana/nueva?id=${c.id}&view=1`)}>
      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        <IconCircle icon={icon} size={60} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <Text variant="subheading" style={{ flex: 1 }}>
              {c.name}
            </Text>
            <CampaignBadge status={c.status} />
          </View>
          {c.status === 'SCHEDULED' && c.scheduledAt ? (
            <View style={styles.metaRow}>
              <CalendarDays size={18} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>
                {fmt.shortDay(c.scheduledAt, tz)} · {fmt.time(c.scheduledAt, tz)}
              </Text>
              <View style={styles.vr} />
              <Users size={18} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>
                {c.eligibleCount ?? '—'} destinatarios elegibles
              </Text>
            </View>
          ) : null}
          {c.status === 'DRAFT' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="caption" color={colors.textMuted}>
                Continúa preparando tu mensaje
              </Text>
              <Text variant="bodyStrong" color={colors.primary}>
                Continuar ›
              </Text>
            </View>
          ) : null}
          {c.status === 'FINISHED' && c.results ? (
            <>
              <Text variant="caption" color={colors.textMuted}>
                Enviada el {c.sentAt ? fmt.shortDay(c.sentAt, tz) : '—'}
              </Text>
              <Divider />
              <View style={styles.metaRow}>
                <Send size={18} color={colors.textMuted} />
                <Text variant="caption">
                  <Text variant="captionStrong">{c.results.sent}</Text> enviados
                </Text>
                <View style={styles.vr} />
                <CircleCheck size={18} color={colors.textMuted} />
                <Text variant="caption">
                  {c.results.delivered !== null ? (
                    <>
                      <Text variant="captionStrong">{c.results.delivered}</Text> entregados
                    </>
                  ) : (
                    'Entrega no disponible'
                  )}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function LoyaltyTab() {
  const m = useBusiness();
  const program = useQuery({ queryKey: ['loyalty-program', m.businessId], queryFn: () => endpoints.loyaltyProgram(m.businessId) });
  const p = program.data;
  const walletLabel = { NOT_LINKED: 'Por vincular', LINKED: 'Vinculado', ERROR: 'Requiere atención' } as const;
  if (program.isLoading) return <SkeletonList rows={3} />;
  if (program.error || !p) return <ErrorState error={program.error} onRetry={() => program.refetch()} />;
  return (
    <>
      <View style={styles.programHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="title">Tu programa</Text>
          <Badge label={p.status === 'ACTIVE' ? 'Activo' : 'Inactivo'} tone={p.status === 'ACTIVE' ? 'success' : 'neutral'} />
        </View>
        {m.permissions.includes('loyalty.configure') ? <LinkButton label="Configurar" onPress={() => router.push('/fidelidad/configurar')} /> : null}
      </View>

      <View style={{ gap: spacing.xs }}>
        <NightCard minHeight={170} style={{ paddingRight: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Text variant="title" color={colors.textOnNight}>
                {m.businessName}
              </Text>
              <Text variant="body" color={colors.textOnNightMuted} style={{ fontSize: 18 }}>
                {p.name}
              </Text>
              <StampRow filled={3} total={p.stampsRequired} size={30} onDark />
              <Text variant="body" color={colors.textOnNight}>
                3 de {p.stampsRequired} sellos
              </Text>
            </View>
            <Ori size={130} />
          </View>
        </NightCard>
        <Text variant="caption" color={colors.textMuted}>
          Vista previa · Progreso de ejemplo
        </Text>
      </View>

      <Card>
        <Text variant="heading" style={{ marginBottom: spacing.sm }}>
          Reglas del programa
        </Text>
        <RuleRow icon={Target} label="Meta" value={`${p.stampsRequired} visitas elegibles`} />
        <Divider />
        <RuleRow icon={Gift} label="Recompensa" value={`${p.reward.description} en el siguiente corte`} />
        <Divider />
        {p.isExampleConfiguration ? (
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
            Valores de ejemplo · Configurables
          </Text>
        ) : null}
      </Card>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Tile icon={Users} label="Ver miembros" onPress={() => router.push('/fidelidad/miembros')} />
        {m.permissions.includes('loyalty.redeem') ? <Tile icon={ScanLine} label="Validar canje" onPress={() => router.push('/fidelidad/canje')} /> : null}
      </View>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, opacity: 0.6 }}>
          <IconCircle icon={History} size={52} />
          <View style={{ flex: 1 }}>
            <Text variant="subheading">Historial de movimientos</Text>
            <Text variant="caption" color={colors.textMuted}>
              Disponible cuando el ledger de fidelidad esté integrado
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text variant="heading" style={{ marginBottom: spacing.sm }}>
          Tarjetas digitales
        </Text>
        <WalletRow label="Apple Wallet" status={walletLabel[p.wallet.apple]} />
        <Divider />
        <WalletRow label="Google Wallet" status={walletLabel[p.wallet.google]} />
        <Divider />
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
          El programa puede operar sin Wallet.
        </Text>
      </Card>
    </>
  );
}

function RuleRow({ icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <IconCircle icon={icon} size={44} />
      <Text variant="body" color={colors.textMuted} style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="bodyStrong" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

function WalletRow({ label, status }: { label: string; status: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <View style={styles.walletIcon}>
        <Wallet size={24} color={colors.textOnNight} />
      </View>
      <Text variant="subheading" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="body" color={colors.textMuted}>
        {status}
      </Text>
    </View>
  );
}

function Tile({ icon: Icon, label, onPress }: { icon: typeof Users; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}>
      <IconCircle icon={Icon} size={52} />
      <Text variant="subheading" style={{ flex: 1 }}>
        {label}
      </Text>
      <ChevronRight size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  waBubble: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#F2FBF5', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.accent },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, flexWrap: 'wrap' },
  vr: { width: 1, height: 18, backgroundColor: colors.border, marginHorizontal: spacing.xs },
  programHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  walletIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' },
});
