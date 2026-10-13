import { CONSENT_STATUS_LABELS } from '@orion/contracts';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowUpDown, CalendarDays, Check, Merge, StickyNote, Star } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { ConsentBadge } from '@/features/privacy';
import { endpoints } from '@/lib/endpoints';
import { useIdempotentMutation } from '@/lib/mutations';
import { useBusiness } from '@/lib/session';
import { Appear, Avatar, Button, Card, colors, ErrorState, IconCircle, LoadingState, Note, Screen, SectionHeader, spacing, StackHeader, Text, useFeedback } from '@/ui';

/** Unir dos registros del mismo cliente. Nunca es automático: se revisa y se confirma. */
export default function MergeCustomers() {
  const params = useLocalSearchParams<{ id: string; with: string }>();
  const m = useBusiness();
  const feedback = useFeedback();
  const [swapped, setSwapped] = useState(false);
  const survivorId = swapped ? params.with : params.id;
  const duplicateId = swapped ? params.id : params.with;
  const q = useQuery({
    queryKey: ['merge-preview', m.businessId, survivorId, duplicateId],
    queryFn: () => endpoints.mergePreview(m.businessId, survivorId, duplicateId),
  });
  const merge = useIdempotentMutation(
    (_: void, requestId) => endpoints.mergeCustomers(m.businessId, survivorId, { requestId, duplicateId }),
    [['customers', m.businessId], ['customer', m.businessId], ['agenda', m.businessId], ['privacy', m.businessId]],
  );
  const p = q.data;

  if (!m.permissions.includes('customers.merge')) {
    return (
      <Screen header={<StackHeader title="Unir registros" />}>
        <Note body="Unir registros lo hacen el dueño o la administración." />
      </Screen>
    );
  }
  if (q.isLoading) return <LoadingState />;
  if (!p) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  const confirm = async () => {
    const res = await feedback.confirm({
      title: 'Unir registros',
      message: `"${p.duplicate.name}" dejará de aparecer y todo pasará a "${p.survivor.name}". No se puede deshacer desde la app.`,
      confirmLabel: 'Unir registros',
      destructive: true,
    });
    if (!res.confirmed) return;
    merge.mutate(undefined, {
      onSuccess: (c) => {
        feedback.celebrate('Registros unidos', `${c.name} conserva todo su historial.`);
        router.replace(`/cliente/${c.id}`);
      },
      onError: (e) => feedback.toast(e.message, 'error'),
    });
  };

  const Person = ({ who, label }: { who: typeof p.survivor; label: string }) => (
    <Card>
      <Text variant="captionStrong" color={colors.textMuted}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <Avatar initials={who.name.charAt(0)} size={44} colorKey={label.startsWith('Se conserva') ? 'lavender' : 'peach'} />
        <View style={{ flex: 1 }}>
          <Text variant="heading">{who.name}</Text>
          <Text variant="caption" color={colors.textMuted}>
            {who.phoneMasked ?? 'Sin teléfono'} · {who.completedVisits === 1 ? '1 visita' : `${who.completedVisits} visitas`}
          </Text>
        </View>
      </View>
    </Card>
  );

  return (
    <Screen
      header={<StackHeader title="Unir registros" subtitle="Posible duplicado" />}
      footer={<Button requiresOnline label="Unir registros" icon={Merge} disabled={!!p.blockedReason} loading={merge.isPending} onPress={() => void confirm()} />}
    >
      <Appear>
        <Person who={p.survivor} label="Se conserva" />
        <View style={{ alignItems: 'center', marginVertical: spacing.xs }}>
          <ArrowDown size={20} color={colors.textMuted} style={{ transform: [{ rotate: '180deg' }] }} />
        </View>
        <Person who={p.duplicate} label="Se une y deja de aparecer" />
        <Button label="Conservar el otro registro" icon={ArrowUpDown} variant="ghost" onPress={() => setSwapped((v) => !v)} />
      </Appear>

      <Appear index={1}>
        <SectionHeader title="Qué va a pasar" />
        <Card style={{ marginTop: spacing.sm, gap: spacing.md }}>
          <Row icon={CalendarDays} text={p.appointmentsToMove === 0 ? 'No hay citas que mover.' : `${p.appointmentsToMove === 1 ? '1 cita pasa' : `${p.appointmentsToMove} citas pasan`} a "${p.survivor.name}", con constancia en su historial.`} />
          <Row icon={StickyNote} text={p.notesToMove === 0 ? 'No hay notas que mover.' : `${p.notesToMove === 1 ? '1 nota interna se mueve' : `${p.notesToMove} notas internas se mueven`}.`} />
          {p.fieldsFilled.length > 0 ? <Row icon={Check} text={`Se completa: ${p.fieldsFilled.join(', ').toLowerCase()}.`} /> : null}
          <Row
            icon={Star}
            text={p.loyalty === 'MOVE' ? 'Su tarjeta de fidelidad pasa al registro que se conserva.' : p.loyalty === 'NONE' ? 'Fidelidad: no hay tarjetas que combinar.' : 'Fidelidad: ambos tienen tarjeta.'}
          />
          <View style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="bodyStrong">Promociones después de unir</Text>
              <ConsentBadge status={p.consentResult} />
            </View>
            <Text variant="caption" color={colors.textMuted}>
              {p.consentExplanation} ({CONSENT_STATUS_LABELS[p.consentResult]})
            </Text>
          </View>
        </Card>
      </Appear>
      {p.blockedReason ? <Note tone="warning" title="No se puede unir todavía" body={p.blockedReason} /> : null}
      <Note body="Un teléfono compartido puede ser de personas distintas (familia, pareja). Une solo si estás seguro de que es la misma persona." />
    </Screen>
  );
}

function Row({ icon, text }: { icon: typeof Check; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <IconCircle icon={icon} size={32} />
      <Text variant="body" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}
