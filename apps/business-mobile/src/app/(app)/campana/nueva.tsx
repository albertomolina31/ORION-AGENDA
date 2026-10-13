import type { AudienceDefinition, CampaignObjective } from '@orion/contracts';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, CalendarDays, Check, ChevronDown, ChevronUp, CircleMinus, Clock, ExternalLink, Gift, Heart, Info, Lock, MessageCircle, RotateCcw, ShieldCheck, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { WhatsAppIcon } from '@/features/WhatsAppIcon';
import { endpoints } from '@/lib/endpoints';
import { addDays } from '@/lib/format';
import { useIdempotentMutation } from '@/lib/mutations';
import { useHome } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import {
  Badge,
  Button,
  CampaignBadge,
  Card,
  Chip,
  colors,
  Divider,
  Field,
  IconCircle,
  LinkButton,
  LoadingState,
  Note,
  radius,
  RadioCard,
  Screen,
  SegmentedControl,
  spacing,
  StackHeader,
  Text,
  Toggle,
  useFeedback,
} from '@/ui';

type Step = 1 | 2 | 3 | 4;
const STEP_LABELS = ['Detalles', 'Audiencia', 'Mensaje', 'Revisión'];
const objectives: Array<{ value: CampaignObjective; title: string; description: string; icon: typeof Gift }> = [
  { value: 'WIN_BACK', title: 'Recuperar clientes', description: 'Invita a volver a quienes llevan tiempo sin visitarte.', icon: RotateCcw },
  { value: 'PROMOTE_SERVICE', title: 'Promocionar un servicio', description: 'Da a conocer un servicio o una oferta especial.', icon: Gift },
  { value: 'THANK_YOU', title: 'Agradecer su preferencia', description: 'Fortalece la relación con tus clientes habituales.', icon: Heart },
];
const segments = [
  { value: 'INACTIVE', label: 'Clientes sin visita reciente' },
  { value: 'FREQUENT', label: 'Clientes frecuentes' },
  { value: 'NEAR_REWARD', label: 'Próximos a recompensa' },
] as const;

/** UI22/UI23 Crear campaña (4 pasos). Nada se envía hasta confirmar; la plantilla debe estar aprobada. */
export default function NewCampaign() {
  const params = useLocalSearchParams<{ id?: string; view?: string }>();
  const m = useBusiness();
  const home = useHome();
  const [campaignId, setCampaignId] = useState<string | null>(params.id ?? null);
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('Vuelve por tu próximo corte');
  const [objective, setObjective] = useState<CampaignObjective>('WIN_BACK');
  const [mode, setMode] = useState<'SEGMENT' | 'MANUAL'>('SEGMENT');
  const [segment, setSegment] = useState<(typeof segments)[number]['value']>('INACTIVE');
  const [inactiveDays, setInactiveDays] = useState(60);
  const [excludeUpcoming, setExcludeUpcoming] = useState(true);
  const [showExcluded, setShowExcluded] = useState(true);
  const [templateId, setTemplateId] = useState('tpl_volver');
  const [benefit, setBenefit] = useState('20 % de descuento en tu próximo corte');
  const [validUntil, setValidUntil] = useState('hasta el 31 de octubre');
  const [when, setWhen] = useState<'NOW' | 'SCHEDULED'>('SCHEDULED');
  const [sendDate, setSendDate] = useState<string | null>(null);
  const [sendTime, setSendTime] = useState('10:00');
  const [message, setMessage] = useState<{ tone: 'info' | 'warning'; text: string } | null>(null);
  const readOnly = params.view === '1';
  const feedback = useFeedback();

  const existing = useQuery({ queryKey: ['campaign', m.businessId, params.id], queryFn: () => endpoints.campaign(m.businessId, params.id!), enabled: !!params.id });
  useEffect(() => {
    const c = existing.data;
    if (!c) return;
    setName(c.name);
    setObjective(c.objective);
    if (c.audience?.mode === 'SEGMENT') {
      setSegment(c.audience.segment);
      setInactiveDays(c.audience.inactiveDays);
      setExcludeUpcoming(c.audience.excludeWithUpcoming);
    }
    if (c.content) {
      setTemplateId(c.content.templateId);
      setBenefit(c.content.benefit);
      setValidUntil(c.content.validUntil);
    }
    if (c.schedule?.mode === 'SCHEDULED') {
      setWhen('SCHEDULED');
      setSendDate(c.schedule.date);
      setSendTime(c.schedule.time);
    }
    if (params.view === '1') setStep(4);
  }, [existing.data, params.view]);
  useEffect(() => {
    if (!sendDate && home.data) setSendDate(addDays(home.data.date, 3));
  }, [home.data, sendDate]);

  const audience: AudienceDefinition = { mode: 'SEGMENT', segment, inactiveDays, excludeWithUpcoming: excludeUpcoming };
  const preview = useQuery({
    queryKey: ['audience', m.businessId, audience],
    queryFn: () => endpoints.audiencePreview(m.businessId, audience),
    enabled: step >= 2 && mode === 'SEGMENT',
  });
  const templates = useQuery({ queryKey: ['templates', m.businessId], queryFn: () => endpoints.templates(m.businessId) });
  const template = templates.data?.find((t) => t.id === templateId);
  const approved = template?.approval === 'APPROVED';

  const body = () => ({
    name,
    objective,
    audience: step >= 2 ? audience : null,
    content: step >= 3 ? { templateId, benefit, validUntil } : null,
    schedule: step >= 4 ? (when === 'NOW' ? { mode: 'NOW' as const } : { mode: 'SCHEDULED' as const, date: sendDate!, time: sendTime }) : null,
  });
  const save = useIdempotentMutation(
    (b: ReturnType<typeof body>, requestId) =>
      campaignId ? endpoints.updateCampaign(m.businessId, campaignId, { ...b, requestId }) : endpoints.createCampaign(m.businessId, { ...b, requestId }),
    [['campaigns', m.businessId]],
  );
  const confirm = useIdempotentMutation((id: string, requestId) => endpoints.confirmCampaign(m.businessId, id, requestId), [['campaigns', m.businessId]]);

  const persist = (then?: (id: string) => void) => {
    setMessage(null);
    save.mutate(body(), {
      onSuccess: (c) => {
        setCampaignId(c.id);
        feedback.toast('Borrador guardado');
        then?.(c.id);
      },
      onError: (e) => setMessage({ tone: 'warning', text: e.message }),
    });
  };

  if (params.id && existing.isLoading) return <LoadingState />;

  return (
    <Screen
      header={
        <StackHeader
          center
          title={readOnly ? 'Campaña' : 'Crear campaña'}
          subtitle={m.businessName}
          right={!readOnly ? <LinkButton label="Guardar" onPress={() => persist()} chevron={false} /> : undefined}
        />
      }
      footer={
        readOnly ? undefined : step < 4 ? (
          <View style={{ gap: spacing.xs }}>
            {step === 2 && preview.data ? (
              <Text variant="caption" color={colors.textMuted}>
                {preview.data.eligible} destinatarios elegibles ahora
              </Text>
            ) : null}
            <Button
              label={step === 1 ? 'Continuar a audiencia' : step === 2 ? 'Continuar al mensaje' : 'Continuar a revisión'}
              trailingIcon={ArrowRight}
              disabled={name.trim().length < 3}
              onPress={() => setStep((step + 1) as Step)}
            />
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Button
              label="Confirmar programación"
              icon={approved ? Check : Lock}
              disabled={!approved}
              loading={confirm.isPending}
              onPress={() => persist((id) => confirm.mutate(id, { onSuccess: () => {
                    feedback.celebrate('¡Campaña programada!');
                    router.back();
                  }, onError: (e) => setMessage({ tone: 'warning', text: e.message }) }))}
            />
            <Button label="Guardar borrador" variant="outline" loading={save.isPending} onPress={() => persist()} />
          </View>
        )
      }
    >
      {existing.data && readOnly ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="title" style={{ flex: 1 }}>
            {existing.data.name}
          </Text>
          <CampaignBadge status={existing.data.status} />
        </View>
      ) : (
        <Stepper step={step} onStep={(s) => s < step && setStep(s)} />
      )}
      {message ? <Note tone={message.tone} body={message.text} /> : null}

      {step === 1 ? (
        <View style={{ gap: spacing.lg }}>
          <StepHeading n={1} title="¿Qué quieres lograr?" subtitle="Define el objetivo. Después elegirás a quién enviar tu campaña." />
          <Field label="Nombre de la campaña" value={name} onChangeText={setName} hint="Solo lo verá tu equipo." maxLength={60} />
          <Text variant="title">Objetivo</Text>
          {objectives.map((o) => (
            <RadioCard key={o.value} title={o.title} description={o.description} icon={o.icon} selected={objective === o.value} onPress={() => setObjective(o.value)} />
          ))}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
              <View style={styles.wa}>
                <WhatsAppIcon size={24} />
              </View>
              <View>
                <Text variant="caption" color={colors.textMuted}>
                  Canal de envío
                </Text>
                <Text variant="heading">WhatsApp</Text>
              </View>
            </View>
          </Card>
          <Note icon={Info} body="El objetivo no selecciona destinatarios automáticamente." />
          <Text variant="caption" color={colors.textMuted}>
            Tu campaña seguirá como borrador hasta confirmar el envío.
          </Text>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: spacing.lg }}>
          <StepHeading n={2} title="¿A quién quieres llegar?" subtitle={name} />
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={[
              { value: 'SEGMENT', label: 'Por segmento' },
              { value: 'MANUAL', label: 'Selección manual' },
            ]}
          />
          {mode === 'MANUAL' ? (
            <Note body="La selección manual de destinatarios llegará en la siguiente iteración. Usa un segmento por ahora." />
          ) : (
            <>
              <Text variant="heading">Segmento</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {segments.map((s) => (
                  <Chip key={s.value} label={s.label} selected={segment === s.value} onPress={() => setSegment(s.value)} />
                ))}
              </View>
              <Card tone="muted">
                <Text variant="subheading">Condiciones del segmento</Text>
                {segment === 'INACTIVE' ? (
                  <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                    <Text variant="body" color={colors.textMuted}>
                      Última visita completada
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                      {[30, 60, 90].map((d) => (
                        <Chip key={d} label={`Hace más de ${d} días`} selected={inactiveDays === d} onPress={() => setInactiveDays(d)} />
                      ))}
                    </View>
                  </View>
                ) : null}
                <View style={{ marginTop: spacing.md }}>
                  <Toggle label="Sin próxima cita" description="Excluye citas confirmadas y solicitudes pendientes." value={excludeUpcoming} onChange={setExcludeUpcoming} />
                </View>
              </Card>
              <Text variant="caption" color={colors.textMuted}>
                Solo clientes con al menos una visita completada. {inactiveDays} días es un ejemplo editable.
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="title">Vista previa de audiencia</Text>
                <Text variant="caption" color={colors.textMuted}>
                  Datos sintéticos
                </Text>
              </View>
              <Card>
                {preview.isLoading ? <LoadingState label="Calculando…" /> : null}
                {preview.data ? (
                  <View style={{ gap: spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.md }}>
                      <Text variant="display">
                        {preview.data.matched}
                      </Text>
                      <Text variant="body">Coinciden con el segmento</Text>
                    </View>
                    <Divider />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                      <IconCircle icon={Check} tone="success" size={32} />
                      <Text variant="body">
                        <Text variant="bodyStrong">{preview.data.eligible}</Text> elegibles para envío
                      </Text>
                    </View>
                    <Divider />
                    <Pressable onPress={() => setShowExcluded(!showExcluded)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }} accessibilityRole="button">
                      <IconCircle icon={CircleMinus} tone="neutral" size={32} />
                      <Text variant="body" style={{ flex: 1 }}>
                        <Text variant="bodyStrong">{preview.data.excluded.noConsent + preview.data.excluded.optedOut}</Text> excluidos
                      </Text>
                      {showExcluded ? <ChevronUp size={20} color={colors.text} /> : <ChevronDown size={20} color={colors.text} />}
                    </Pressable>
                    {showExcluded ? (
                      <View style={{ paddingLeft: spacing.xxl + 12, gap: 4, borderLeftWidth: 2, borderLeftColor: colors.border, marginLeft: spacing.lg }}>
                        <Text variant="caption">
                          <Text variant="captionStrong">{preview.data.excluded.noConsent}</Text> sin consentimiento promocional
                        </Text>
                        <Text variant="caption">
                          <Text variant="captionStrong">{preview.data.excluded.optedOut}</Text> con baja de promociones
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </Card>
              <Note icon={ShieldCheck} body="La elegibilidad se verificará de nuevo antes del envío." />
              <Text variant="caption" color={colors.textMuted}>
                Si alguien retira su consentimiento, no recibirá la campaña.
              </Text>
            </>
          )}
        </View>
      ) : null}

      {step === 3 ? (
        <View style={{ gap: spacing.lg }}>
          <StepHeading n={3} title="Prepara tu mensaje" subtitle="Personaliza una plantilla y revisa cómo se verá." />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {templates.data?.map((t) => <Chip key={t.id} label={t.name} selected={templateId === t.id} onPress={() => setTemplateId(t.id)} />)}
          </View>
          {template ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Badge label={approved ? 'Plantilla aprobada' : 'Pendiente de aprobación'} tone={approved ? 'success' : 'warning'} />
              {!approved ? (
                <Text variant="caption" color={colors.textMuted}>
                  No disponible para enviar todavía.
                </Text>
              ) : null}
            </View>
          ) : null}
          <Text variant="title">Personalización</Text>
          <Field label="Beneficio" value={benefit} onChangeText={setBenefit} maxLength={80} />
          <Field label="Vigencia" value={validUntil} onChangeText={setValidUntil} maxLength={40} hint="El nombre se completa con los datos del cliente." />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="title">Vista previa</Text>
            <Text variant="caption" color={colors.textMuted}>
              Ejemplo
            </Text>
          </View>
          <View style={styles.chatBg}>
            <View style={styles.bubble}>
              <Text variant="subheading">{m.businessName}</Text>
              <Text variant="body">
                {(template?.body ?? '')
                  .replace('{{customerName}}', 'Lucía')
                  .replace('{{benefit}}', benefit)
                  .replace('{{validUntil}}', validUntil)}
              </Text>
              <Divider />
              <Text variant="caption" color={colors.textMuted}>
                Para dejar de recibir promociones, responde BAJA.
              </Text>
              <Divider />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <CalendarDays size={20} color={colors.primary} />
                <Text variant="bodyStrong" color={colors.primary} style={{ flex: 1 }}>
                  Reservar cita
                </Text>
                <ExternalLink size={18} color={colors.primary} />
              </View>
            </View>
          </View>
          <Note icon={Info} body="Esta vista previa no envía mensajes." />
          {!approved ? <Note icon={Clock} tone="warning" body="Podrás guardar y revisar. El envío requiere una plantilla aprobada." /> : null}
        </View>
      ) : null}

      {step === 4 ? (
        <View style={{ gap: spacing.lg }}>
          {!readOnly ? <StepHeading n={4} title="Revisa tu campaña" subtitle="Nada se enviará hasta que confirmes." /> : null}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text variant="heading" style={{ flex: 1 }}>
                {name}
              </Text>
              <CampaignBadge status={existing.data?.status ?? 'DRAFT'} />
            </View>
          </Card>
          <ReviewCard icon={Users} title="Audiencia" onEdit={readOnly ? undefined : () => setStep(2)}>
            <Text variant="heading">{preview.data?.eligible ?? existing.data?.eligibleCount ?? '—'} elegibles ahora</Text>
            {preview.data ? (
              <Text variant="caption" color={colors.textMuted}>
                {preview.data.matched} coinciden · {preview.data.excluded.noConsent + preview.data.excluded.optedOut} excluidos
              </Text>
            ) : null}
            <Text variant="caption" color={colors.textMuted}>
              {segments.find((s) => s.value === segment)?.label}
              {segment === 'INACTIVE' ? ` · más de ${inactiveDays} días` : ''}
              {excludeUpcoming ? ' · sin próxima cita' : ''}.
            </Text>
          </ReviewCard>
          <ReviewCard icon={MessageCircle} title="Mensaje" onEdit={readOnly ? undefined : () => setStep(3)}>
            <Text variant="body">{template?.name}</Text>
            <Badge label={approved ? 'Plantilla aprobada' : 'Pendiente de aprobación'} tone={approved ? 'success' : 'warning'} />
            <Text variant="caption" color={colors.textMuted}>
              {benefit} · {validUntil}
            </Text>
          </ReviewCard>
          {!readOnly ? (
            <ReviewCard icon={CalendarDays} title="¿Cuándo quieres enviarla?">
              <View style={{ gap: spacing.sm }}>
                <RadioCard title="Ahora" description="Enviar de inmediato" selected={when === 'NOW'} onPress={() => setWhen('NOW')} />
                <RadioCard title="Programar" description="Elegir fecha y hora" selected={when === 'SCHEDULED'} onPress={() => setWhen('SCHEDULED')} />
                {when === 'SCHEDULED' && sendDate ? (
                  <>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                      {[1, 2, 3, 7].map((d) => {
                        const date = addDays(home.data?.date ?? sendDate, d);
                        return <Chip key={d} label={date.slice(8) + '/' + date.slice(5, 7)} selected={sendDate === date} onPress={() => setSendDate(date)} />;
                      })}
                    </View>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {['09:00', '10:00', '12:00', '17:00'].map((t) => (
                        <Chip key={t} label={t} selected={sendTime === t} onPress={() => setSendTime(t)} />
                      ))}
                    </View>
                    <Text variant="caption" color={colors.textMuted}>
                      Hora del negocio · {m.timezone}. Horario propuesto; aún no está programada.
                    </Text>
                  </>
                ) : null}
              </View>
            </ReviewCard>
          ) : null}
          {!approved && !readOnly ? (
            <Note icon={Clock} tone="warning" title="Todavía no puedes programarla" body="La plantilla está pendiente de aprobación." />
          ) : null}
          <Note icon={Info} body="Volveremos a validar los destinatarios antes del envío. Pausar o cancelar no retira mensajes ya enviados." />
        </View>
      ) : null}
    </Screen>
  );
}

function Stepper({ step, onStep }: { step: Step; onStep: (s: Step) => void }) {
  return (
    <View style={{ flexDirection: 'row' }} accessibilityLabel={`Paso ${step} de 4`}>
      {STEP_LABELS.map((label, i) => {
        const n = (i + 1) as Step;
        const done = n < step;
        const active = n === step;
        return (
          <Pressable key={label} onPress={() => onStep(n)} disabled={!done} style={{ flex: 1, alignItems: 'center', gap: 4 }} accessibilityRole="button">
            <View style={[styles.dot, (done || active) && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              {done ? <Check size={22} color={colors.textOnPrimary} /> : <Text variant="heading" color={active ? colors.textOnPrimary : colors.primary}>{n}</Text>}
            </View>
            <Text variant="captionStrong" color={active || done ? colors.primary : colors.textMuted}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StepHeading({ n, title, subtitle }: { n: number; title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="body" color={colors.textMuted}>
        Paso {n} de 4
      </Text>
      <Text variant="title">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" color={colors.textMuted}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function ReviewCard({ icon, title, onEdit, children }: { icon: typeof Users; title: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        <IconCircle icon={icon} square size={44} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="subheading">{title}</Text>
            {onEdit ? <LinkButton label="Editar" onPress={onEdit} chevron={false} /> : null}
          </View>
          {children}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  dot: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  wa: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.whatsappSoft, alignItems: 'center', justifyContent: 'center' },
  chatBg: { padding: spacing.xl, borderRadius: radius.lg, backgroundColor: '#EEF3EC' },
  bubble: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, ...{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 } },
});
