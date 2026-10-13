import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarCheck, Minus, Plus, ShieldCheck, Star } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { endpoints } from '@/lib/endpoints';
import { useBusiness } from '@/lib/session';
import { useServices } from '@/lib/queries';
import { Badge, Button, Card, Chip, colors, Divider, ErrorState, Field, IconCircle, LoadingState, Note, radius, Screen, spacing, StackHeader, Text } from '@/ui';

/**
 * Configurar programa (diseño aprobado). Las reglas pertenecen al módulo de Sergio:
 * aquí se prepara la propuesta y se revisa su efecto; nada cambia hasta confirmar
 * en el módulo de fidelidad (aún no integrado).
 */
export default function ConfigureLoyalty() {
  const m = useBusiness();
  const program = useQuery({ queryKey: ['loyalty-program', m.businessId], queryFn: () => endpoints.loyaltyProgram(m.businessId) });
  const services = useServices();
  const [stamps, setStamps] = useState(7);
  const [discount, setDiscount] = useState('20');
  const [eligible, setEligible] = useState<string[]>([]);
  const [rewardValidity, setRewardValidity] = useState(30);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (program.data) {
      setStamps(program.data.stampsRequired);
      setDiscount(String(program.data.reward.value));
      setEligible(program.data.eligibleServiceIds);
      setRewardValidity(program.data.rewardValidityDays);
    }
  }, [program.data]);

  if (program.isLoading) return <LoadingState />;
  if (program.error || !program.data) return <ErrorState error={program.error} onRetry={() => program.refetch()} />;
  const p = program.data;
  const dirty = stamps !== p.stampsRequired || discount !== String(p.reward.value) || rewardValidity !== p.rewardValidityDays || eligible.join() !== p.eligibleServiceIds.join();
  const rewardService = services.data?.find((s) => s.id === p.reward.serviceId)?.name.toLowerCase() ?? 'servicio';

  return (
    <Screen
      header={<StackHeader title="Configurar programa" subtitle={m.businessName} right={dirty ? <Badge label="Cambios sin aplicar" tone="warning" /> : undefined} />}
      footer={
        <View style={{ gap: spacing.xs }}>
          <Button label="Revisar cambios" trailingIcon={ArrowRight} disabled={!dirty} onPress={() => setReviewing(true)} />
          <Text variant="caption" color={colors.textMuted} align="center">
            Nada cambia hasta que confirmes.
          </Text>
        </View>
      }
    >
      <Text variant="body" color={colors.textMuted}>
        Define cómo premiar cada visita.
      </Text>

      <StepTitle n={1} title="Cómo se ganan sellos" />
      <Card>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <IconCircle icon={CalendarCheck} size={64} />
          <View style={{ flex: 1 }}>
            <Text variant="subheading">1 sello por visita elegible</Text>
            <Text variant="caption" color={colors.textMuted}>
              Se acredita al completar y validar la cita.
            </Text>
          </View>
        </View>
        <Divider />
        <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
          Servicios participantes
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {(services.data ?? [])
            .filter((s) => s.active)
            .map((s) => (
              <Chip
                key={s.id}
                label={s.name}
                selected={eligible.includes(s.id)}
                onPress={() => setEligible(eligible.includes(s.id) ? eligible.filter((x) => x !== s.id) : [...eligible, s.id])}
              />
            ))}
        </View>
      </Card>

      <StepTitle n={2} title="Meta y recompensa" />
      <Card>
        <View style={styles.inline}>
          <Text variant="body" color={colors.textMuted} style={{ flex: 1 }}>
            Sellos necesarios
          </Text>
          <Pressable onPress={() => setStamps(Math.max(2, stamps - 1))} accessibilityRole="button" accessibilityLabel="Restar un sello" style={styles.stepBtn}>
            <Minus size={22} color={colors.primary} />
          </Pressable>
          <View style={styles.stepValue}>
            <Text variant="heading" accessibilityLiveRegion="polite">
              {stamps}
            </Text>
          </View>
          <Pressable onPress={() => setStamps(Math.min(20, stamps + 1))} accessibilityRole="button" accessibilityLabel="Sumar un sello" style={styles.stepBtn}>
            <Plus size={22} color={colors.primary} />
          </Pressable>
        </View>
        <Divider />
        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          <Field label="Tipo de recompensa" value="Descuento porcentual" editable={false} />
          <Field label="Descuento (%)" value={discount} onChangeText={(t) => setDiscount(t.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" />
          <Field label="Aplicable a" value={rewardService.charAt(0).toUpperCase() + rewardService.slice(1)} editable={false} hint="En una visita posterior a completar la meta." />
        </View>
      </Card>

      <StepTitle n={3} title="Vigencia" />
      <Card>
        <View style={styles.inline}>
          <Text variant="body" color={colors.textMuted} style={{ flex: 1 }}>
            Sellos
          </Text>
          <Text variant="bodyStrong">Sin vencimiento</Text>
        </View>
        <Divider />
        <View style={[styles.inline, { marginTop: spacing.md, flexWrap: 'wrap' }]}>
          <Text variant="body" color={colors.textMuted} style={{ flex: 1 }}>
            Recompensa
          </Text>
          {[15, 30, 60].map((d) => (
            <Chip key={d} label={`${d} días`} selected={rewardValidity === d} onPress={() => setRewardValidity(d)} />
          ))}
        </View>
      </Card>

      <Card tone="muted">
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <IconCircle icon={Star} tone="warning" size={60} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="subheading">Así lo verá el cliente</Text>
            <Text variant="body" color={colors.textMuted}>
              Completa {stamps} visitas elegibles y obtén <Text variant="bodyStrong">{discount || 0} %</Text> en tu próximo{' '}
              <Text variant="bodyStrong">{rewardService}</Text>.
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              Recompensa válida durante {rewardValidity} días.
            </Text>
          </View>
        </View>
      </Card>

      <Note icon={ShieldCheck} tone="warning" title="Protege el progreso existente" body="Antes de aplicar cambios, revisaremos su efecto en los sellos y recompensas actuales." />

      {reviewing ? (
        <Note
          title="Revisión preparada"
          body="El módulo de fidelidad (Sergio) aún no está integrado: estos cambios no se aplican. La propuesta queda lista para revisarla con el equipo."
        />
      ) : null}
    </Screen>
  );
}

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={styles.stepNum}>
        <Text variant="bodyStrong">{n}</Text>
      </View>
      <Text variant="title">{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.md },
  stepBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 64, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepNum: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
