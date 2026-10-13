import type { BookingPolicy, BusinessCategory, PolicyChangeResult } from '@orion/contracts';
import { SLOT_GRANULARITIES } from '@orion/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, ChevronDown, ChevronUp, History, Store, TriangleAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { NumberStepper } from '@/features/TimeStepper';
import { endpoints } from '@/lib/endpoints';
import { fmt } from '@/lib/format';
import { useIdempotentMutation } from '@/lib/mutations';
import { useProfile } from '@/lib/queries';
import { useBusiness, useSession } from '@/lib/session';
import {
  Appear,
  Button,
  Card,
  Chip,
  colors,
  Divider,
  ErrorState,
  Field,
  haptic,
  IconCircle,
  Note,
  Screen,
  SectionHeader,
  SegmentedControl,
  SkeletonList,
  spacing,
  StackHeader,
  Text,
  Toggle,
  useFeedback,
} from '@/ui';

const CATEGORIES: Array<{ value: BusinessCategory; label: string }> = [
  { value: 'HAIR_BEAUTY', label: 'Peluquería y belleza' },
  { value: 'NAILS_BEAUTY', label: 'Manicura y belleza' },
  { value: 'CLINIC', label: 'Consultorio' },
  { value: 'CONSULTING', label: 'Consultoría' },
  { value: 'OTHER', label: 'Otro' },
];

type PolicyFields = Omit<BookingPolicy, 'version'>;

const dur = (min: number) => {
  if (min === 0) return '0 min';
  if (min % 1440 === 0) return `${min / 1440} d`;
  if (min % 60 === 0) return `${min / 60} h`;
  return min > 60 ? `${Math.floor(min / 60)} h ${min % 60}` : `${min} min`;
};

/**
 * UI15 Perfil y reglas de reserva. Cambiar una regla crea una versión nueva: aplica a
 * solicitudes nuevas y las citas existentes conservan la suya (L17). Siempre se revisa
 * el efecto antes de confirmar.
 */
export default function Rules() {
  const m = useBusiness();
  const { refreshMe } = useSession();
  const qc = useQueryClient();
  const q = useProfile();
  const feedback = useFeedback();
  const canEdit = m.permissions.includes('business.configure');
  const history = useQuery({ queryKey: ['policy-history', m.businessId], queryFn: () => endpoints.policyHistory(m.businessId), enabled: canEdit });
  const p = q.data;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<BusinessCategory>('OTHER');
  const [accepting, setAccepting] = useState(true);
  const [policy, setPolicy] = useState<PolicyFields | null>(null);
  const [review, setReview] = useState<PolicyChangeResult | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!p) return;
    setName(p.name);
    setCategory(p.category);
    setAccepting(p.acceptingExternalBookings);
    const { version: _v, ...rest } = p.policy;
    setPolicy(rest);
    setReview(null);
  }, [p]);

  const profileDirty = !!p && (name.trim() !== p.name || category !== p.category || accepting !== p.acceptingExternalBookings);
  const policyDirty = !!p && !!policy && (Object.keys(policy) as Array<keyof PolicyFields>).some((k) => policy[k] !== p.policy[k]);

  const saveProfile = useIdempotentMutation(
    (_: void, requestId) => endpoints.updateProfile(m.businessId, { requestId, name: name.trim(), category, acceptingExternalBookings: accepting }),
    [['profile', m.businessId], ['home', m.businessId]],
  );
  const savePolicy = useIdempotentMutation(
    (_: void, requestId) => endpoints.updatePolicy(m.businessId, { requestId, ...policy! }),
    [['profile', m.businessId], ['policy-history', m.businessId], ['availability', m.businessId], ['agenda', m.businessId]],
  );

  const set = <K extends keyof PolicyFields>(k: K, v: PolicyFields[K]) => {
    setPolicy((cur) => (cur ? { ...cur, [k]: v } : cur));
    setReview(null);
  };

  const startReview = async () => {
    setReviewing(true);
    try {
      setReview(await endpoints.updatePolicy(m.businessId, { requestId: 'preview-only', dryRun: true, ...policy! }));
    } catch (e) {
      feedback.toast((e as Error).message, 'error');
    } finally {
      setReviewing(false);
    }
  };

  const applyPolicy = () =>
    savePolicy.mutate(undefined, {
      onSuccess: (r) => {
        feedback.toast(`Reglas actualizadas · versión ${r.policy.version}`);
        setReview(null);
      },
      onError: (e) => {
        savePolicy.resetKey();
        feedback.toast(e.message, 'error');
      },
    });

  if (q.isLoading || !p || !policy) {
    return (
      <Screen header={<StackHeader title="Perfil y reglas" subtitle={m.businessName} />}>
        {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <SkeletonList rows={4} />}
      </Screen>
    );
  }

  const footer = !canEdit ? undefined : review ? (
    <Button requiresOnline label="Confirmar cambios" icon={Check} loading={savePolicy.isPending} onPress={applyPolicy} />
  ) : policyDirty ? (
    <Button requiresOnline label="Revisar cambios" trailingIcon={ArrowRight} loading={reviewing} onPress={startReview} />
  ) : undefined;

  return (
    <Screen header={<StackHeader title="Perfil y reglas" subtitle={m.businessName} />} onRefresh={() => q.refetch()} refreshing={q.isRefetching} footer={footer}>
      {!canEdit ? <Note body="Solo lectura: cambiar el perfil o las reglas requiere permiso de configuración del negocio." /> : null}

      <Appear>
        <SectionHeader title="Perfil del negocio" />
        <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
          <Field label="Nombre" value={name} onChangeText={setName} editable={canEdit} maxLength={80} />
          <View style={{ gap: spacing.xs }}>
            <Text variant="captionStrong" color={colors.textMuted}>
              Tipo de negocio
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {CATEGORIES.map((c) => (
                <Chip key={c.value} label={c.label} selected={category === c.value} onPress={() => canEdit && setCategory(c.value)} />
              ))}
            </View>
            <Text variant="caption" color={colors.textMuted}>
              Cambia la terminología (Clientes o Pacientes), no los permisos.
            </Text>
          </View>
          <Card>
            <Toggle
              label="Recibir reservas externas"
              description={accepting ? 'WhatsApp y enlaces de reserva pueden crear solicitudes.' : 'Pausado: la agenda interna sigue operando y las citas existentes no cambian.'}
              value={accepting}
              onChange={(v) => canEdit && setAccepting(v)}
            />
            <Divider />
            <View style={{ flexDirection: 'row', gap: spacing.md, paddingTop: spacing.sm }}>
              <IconCircle icon={Store} size={32} />
              <Text variant="caption" color={colors.textMuted} style={{ flex: 1 }}>
                Zona horaria {p.timezone} · Moneda {p.currency}. No se editan en el piloto: cambiarlas reinterpretaría citas e importes.
              </Text>
            </View>
          </Card>
          {canEdit && profileDirty ? (
            <Button requiresOnline
              label="Guardar perfil"
              variant="outline"
              loading={saveProfile.isPending}
              onPress={() =>
                saveProfile.mutate(undefined, {
                  onSuccess: async () => {
                    await refreshMe();
                    void qc.invalidateQueries();
                    feedback.toast('Perfil actualizado');
                  },
                  onError: (e) => {
                    saveProfile.resetKey();
                    feedback.toast(e.message, 'error');
                  },
                })
              }
            />
          ) : null}
        </View>
      </Appear>

      <Appear index={1}>
        <SectionHeader title="Reglas de reserva" trailing={<Text variant="captionStrong" color={colors.primary}>v{p.policy.version}</Text>} />
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2, marginBottom: spacing.sm }}>
          Aplican a solicitudes nuevas. Valores de partida propuestos; ajústalos a tu operación.
        </Text>
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="captionStrong" color={colors.textMuted}>
              Solicitudes por WhatsApp
            </Text>
            <SegmentedControl
              value={policy.confirmationMode}
              onChange={(v) => canEdit && set('confirmationMode', v)}
              options={[
                { value: 'MANUAL', label: 'Requieren aprobación' },
                { value: 'AUTOMATIC', label: 'Se confirman solas' },
              ]}
            />
          </View>
          <Card padded={false}>
            {policy.confirmationMode === 'MANUAL' ? (
              <Rule label="Plazo para aprobar" hint="Después, la solicitud vence y el horario se libera">
                <NumberStepper value={policy.approvalWindowMin} onChange={(v) => set('approvalWindowMin', v)} step={5} min={5} max={1440} suffix="min" />
              </Rule>
            ) : null}
            <Rule label="Anticipación mínima" hint={`No se reserva con menos de ${dur(policy.minLeadMin)}`}>
              <NumberStepper value={policy.minLeadMin} onChange={(v) => set('minLeadMin', v)} step={15} max={10080} suffix="min" />
            </Rule>
            <Rule label="Horizonte máximo" hint="Hasta cuándo se abre la agenda">
              <NumberStepper value={policy.maxHorizonDays} onChange={(v) => set('maxHorizonDays', v)} step={5} min={1} max={365} suffix="días" />
            </Rule>
            <Rule label="Cancelación del cliente" hint={`Hasta ${dur(policy.customerCancelUntilMin)} antes`}>
              <NumberStepper value={policy.customerCancelUntilMin} onChange={(v) => set('customerCancelUntilMin', v)} step={30} max={10080} suffix="min" />
            </Rule>
            <Rule label="Reprogramación del cliente" hint={`Hasta ${dur(policy.customerRescheduleUntilMin)} antes`}>
              <NumberStepper value={policy.customerRescheduleUntilMin} onChange={(v) => set('customerRescheduleUntilMin', v)} step={30} max={10080} suffix="min" />
            </Rule>
            <Rule label='Margen para "No asistió"' hint="Desde la hora de inicio" last>
              <NumberStepper value={policy.noShowGraceMin} onChange={(v) => set('noShowGraceMin', v)} step={5} max={120} suffix="min" />
            </Rule>
          </Card>
          <View style={{ gap: spacing.xs }}>
            <Text variant="captionStrong" color={colors.textMuted}>
              Intervalo entre opciones de horario
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {SLOT_GRANULARITIES.map((g) => (
                <Chip key={g} label={`${g} min`} selected={policy.slotGranularityMin === g} onPress={() => canEdit && set('slotGranularityMin', g)} />
              ))}
            </View>
            <Text variant="caption" color={colors.textMuted}>
              No cambia la duración de los servicios.
            </Text>
          </View>
        </View>
      </Appear>

      {review ? (
        <Appear>
          <Card tone="accent">
            <Text variant="heading">Revisa el efecto</Text>
            <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
              {review.changes.map((c) => (
                <View key={c.field} style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Text variant="caption" color={colors.textMuted} style={{ flex: 1 }}>
                    {c.label}
                  </Text>
                  <Text variant="caption" color={colors.textSubtle} style={{ textDecorationLine: 'line-through' }}>
                    {c.from}
                  </Text>
                  <Text variant="captionStrong">→ {c.to}</Text>
                </View>
              ))}
            </View>
            <Divider />
            <Text variant="body" style={{ marginTop: spacing.sm }}>
              Se creará la <Text variant="bodyStrong">versión {review.policy.version}</Text>.{' '}
              {review.appointmentsKeepingPreviousVersion > 0
                ? `${review.appointmentsKeepingPreviousVersion} citas activas conservarán las reglas con que se reservaron.`
                : 'No hay citas activas afectadas.'}
            </Text>
          </Card>
          {review.warnings.map((w) => (
            <View key={w} style={{ marginTop: spacing.sm }}>
              <Note icon={TriangleAlert} tone="warning" body={w} />
            </View>
          ))}
        </Appear>
      ) : null}

      {canEdit && history.data && history.data.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Pressable
            onPress={() => {
              haptic.select();
              setShowHistory(!showHistory);
            }}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
          >
            <History size={18} color={colors.textMuted} />
            <Text variant="subheading" style={{ flex: 1 }}>
              Historial de versiones ({history.data.length})
            </Text>
            {showHistory ? <ChevronUp size={18} color={colors.textMuted} /> : <ChevronDown size={18} color={colors.textMuted} />}
          </Pressable>
          {showHistory ? (
            <Card padded={false}>
              {history.data.map((h, i) => (
                <View key={h.version}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ padding: spacing.md, gap: 2 }}>
                    <Text variant="bodyStrong">
                      Versión {h.version}
                      {i === 0 ? ' · vigente' : ''}
                    </Text>
                    <Text variant="caption" color={colors.textMuted}>
                      {fmt.shortDay(h.changedAt, m.timezone)} · {h.changedBy} · {h.policy.confirmationMode === 'MANUAL' ? 'Con aprobación' : 'Automática'} · cancelación {dur(h.policy.customerCancelUntilMin)}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function Rule({ label, hint, children, last }: { label: string; hint?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{label}</Text>
          {hint ? (
            <Text variant="caption" color={colors.textMuted}>
              {hint}
            </Text>
          ) : null}
        </View>
        {children}
      </View>
      {!last ? <Divider /> : null}
    </>
  );
}
