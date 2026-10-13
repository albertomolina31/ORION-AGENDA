import { UpdateConsentRequest } from '@orion/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, MessageCircleOff, MessageCircleHeart } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { ConsentBadge } from '@/features/privacy';
import { endpoints } from '@/lib/endpoints';
import { useIdempotentMutation } from '@/lib/mutations';
import { useCustomer } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import { Button, Chip, colors, ErrorState, Field, LoadingState, Note, RadioCard, Screen, SectionHeader, spacing, StackHeader, Text, useFeedback } from '@/ui';

/** Registrar consentimiento promocional o baja, con constancia de cómo se obtuvo. */
export default function ConsentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const m = useBusiness();
  const q = useCustomer(id);
  const feedback = useFeedback();
  const c = q.data;
  const [status, setStatus] = useState<'GRANTED' | 'REVOKED' | null>(null);
  const [source, setSource] = useState<'STAFF_APP' | 'CUSTOMER_REQUEST'>('STAFF_APP');
  const [evidence, setEvidence] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const save = useIdempotentMutation(
    (body: Omit<UpdateConsentRequest, 'requestId'>, requestId) => endpoints.updateConsent(m.businessId, id, { ...body, requestId }),
    [['customer', m.businessId, id], ['customers', m.businessId], ['privacy', m.businessId]],
  );

  if (q.isLoading) return <LoadingState />;
  if (!c) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const target = status ?? (c.promotionalConsent === 'GRANTED' ? 'REVOKED' : 'GRANTED');

  const submit = () => {
    const body = { status: target, source, evidence: evidence.trim() || undefined };
    const local = UpdateConsentRequest.safeParse({ ...body, requestId: 'local-validation' });
    if (!local.success) {
      const fe: Record<string, string[]> = {};
      local.error.issues.forEach((i) => (fe[String(i.path[0])] ??= []).push(i.message));
      setErrors(fe);
      return;
    }
    setErrors({});
    save.mutate(body, {
      onSuccess: () => {
        feedback.toast(target === 'GRANTED' ? 'Consentimiento registrado' : 'Baja registrada');
        router.back();
      },
      onError: (e) => setErrors(e.fieldErrors ?? { evidence: [e.message] }),
    });
  };

  return (
    <Screen header={<StackHeader title="Promociones por WhatsApp" subtitle={c.name} />} footer={<Button requiresOnline label="Guardar" icon={Check} onPress={submit} loading={save.isPending} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="body" color={colors.textMuted}>
          Estado actual
        </Text>
        <ConsentBadge status={c.promotionalConsent} />
      </View>
      <SectionHeader title="¿Qué quieres registrar?" />
      <View style={{ gap: spacing.sm }}>
        <RadioCard icon={MessageCircleHeart} title="Acepta recibir promociones" description="Solo si el cliente lo dijo claramente. Hay que dejar constancia." selected={target === 'GRANTED'} onPress={() => setStatus('GRANTED')} />
        <RadioCard icon={MessageCircleOff} title="Ya no quiere promociones" description="Deja de recibir campañas de inmediato. Sigue recibiendo avisos de sus citas." selected={target === 'REVOKED'} onPress={() => setStatus('REVOKED')} />
      </View>
      <SectionHeader title="¿Cómo lo supiste?" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Chip label="Lo dijo en el negocio" selected={source === 'STAFF_APP'} onPress={() => setSource('STAFF_APP')} />
        <Chip label="Lo pidió el cliente por otro medio" selected={source === 'CUSTOMER_REQUEST'} onPress={() => setSource('CUSTOMER_REQUEST')} />
      </View>
      <Field
        label={target === 'GRANTED' ? 'Constancia (obligatoria)' : 'Comentario (opcional)'}
        value={evidence}
        onChangeText={setEvidence}
        maxLength={200}
        placeholder={target === 'GRANTED' ? 'Ej.: Lo aceptó en mostrador al pagar' : 'Ej.: Pidió no recibir más mensajes'}
        error={errors.evidence?.[0]}
      />
      <Note body="Tener su teléfono o una cita no equivale a permiso. Cada cambio queda registrado con fecha, persona y constancia." />
    </Screen>
  );
}
