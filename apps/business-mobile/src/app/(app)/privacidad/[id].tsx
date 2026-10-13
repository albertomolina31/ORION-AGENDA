import { PRIVACY_REQUEST_TYPE_LABELS, type PrivacyRequestAction } from '@orion/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, Download, Eraser, PencilLine, PlayCircle, XCircle } from 'lucide-react-native';
import { View } from 'react-native';
import { requestIcon, requestTone } from '@/features/privacy';
import { endpoints } from '@/lib/endpoints';
import { fmt } from '@/lib/format';
import { useIdempotentMutation } from '@/lib/mutations';
import { useBusiness } from '@/lib/session';
import { shareTextFile } from '@/lib/share-file';
import { Appear, Badge, Button, Card, colors, ErrorState, IconCircle, LoadingState, Note, Screen, SectionHeader, spacing, StackHeader, Text, useFeedback } from '@/ui';

/** Detalle de una solicitud de derechos: qué hacer según el tipo y constancia de la respuesta. */
export default function PrivacyRequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const m = useBusiness();
  const qc = useQueryClient();
  const feedback = useFeedback();
  const q = useQuery({ queryKey: ['privacy-request', m.businessId, id], queryFn: () => endpoints.privacyRequest(m.businessId, id) });
  const r = q.data;
  const invalidate = [['privacy', m.businessId], ['privacy-request', m.businessId, id], ['customers', m.businessId], ['customer', m.businessId]];

  const transition = useIdempotentMutation(
    ({ action, note }: { action: PrivacyRequestAction; note?: string }, requestId) => endpoints.privacyTransition(m.businessId, id, action, { requestId, note }),
    invalidate,
  );
  const anonymize = useIdempotentMutation(
    ({ customerId, confirmName }: { customerId: string; confirmName: string }, requestId) =>
      endpoints.anonymizeCustomer(m.businessId, customerId, { requestId, confirmName, privacyRequestId: id }),
    invalidate,
  );
  const exporting = useIdempotentMutation(async (customerId: string) => {
    const data = await endpoints.exportCustomer(m.businessId, customerId);
    await shareTextFile(`datos-${customerId}.json`, JSON.stringify(data, null, 2));
    return data;
  });

  if (q.isLoading) return <LoadingState />;
  if (q.error || !r)
    return (
      <Screen header={<StackHeader title="Solicitud" />}>
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </Screen>
    );

  const open = r.allowedActions.length > 0;
  const tz = m.timezone;

  const run = async (action: PrivacyRequestAction) => {
    let note: string | undefined;
    if (action !== 'start') {
      const res = await feedback.confirm({
        title: action === 'complete' ? 'Marcar como atendida' : 'Rechazar solicitud',
        message:
          action === 'complete'
            ? r.type === 'OPPOSITION'
              ? 'Se registrará la baja de promociones del cliente. Escribe qué se le respondió.'
              : 'Escribe qué se le respondió al cliente. Queda como constancia.'
            : 'Escribe el motivo que se le comunicó al cliente (p. ej. no se pudo verificar su identidad).',
        confirmLabel: action === 'complete' ? 'Marcar como atendida' : 'Rechazar',
        destructive: action === 'reject',
        requireReason: true,
        reasonLabel: 'Respuesta al cliente',
      });
      if (!res.confirmed) return;
      note = res.reason;
    }
    transition.mutate(
      { action, note },
      {
        onSuccess: () => (action === 'complete' ? feedback.celebrate('Solicitud atendida', 'Quedó registrada la respuesta.') : feedback.toast(action === 'start' ? 'Solicitud en proceso' : 'Solicitud rechazada')),
        onError: (e) => feedback.toast(e.message, 'error'),
      },
    );
  };

  const eraseData = async () => {
    const res = await feedback.confirm({
      title: 'Eliminar datos del cliente',
      message: `Se borrarán nombre, teléfono, correo y notas de ${r.customer.name}. Sus citas e importes se conservan como "Cliente eliminado". No se puede deshacer. Escribe su nombre para confirmar.`,
      confirmLabel: 'Eliminar datos',
      destructive: true,
      requireReason: true,
      reasonLabel: 'Nombre del cliente',
    });
    if (!res.confirmed || !res.reason) return;
    anonymize.mutate(
      { customerId: r.customer.id, confirmName: res.reason },
      {
        onSuccess: () => {
          feedback.toast('Datos eliminados');
          void qc.invalidateQueries({ queryKey: ['privacy-request', m.businessId, id] });
        },
        onError: (e) => feedback.toast(e.message, 'error'),
      },
    );
  };

  return (
    <Screen header={<StackHeader title={`Solicitud de ${r.typeLabel.toLowerCase()}`} subtitle={m.businessName} />} onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Appear>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <IconCircle icon={requestIcon[r.type]} tone={open ? 'warning' : 'neutral'} size={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading">{r.customer.name}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {PRIVACY_REQUEST_TYPE_LABELS[r.type].description}
              </Text>
            </View>
            <Badge label={r.statusLabel} tone={requestTone[r.status]} />
          </View>
          <View style={{ marginTop: spacing.md, gap: 4 }}>
            <Text variant="caption" color={colors.textMuted}>
              Recibida {fmt.shortDay(r.receivedAt, tz)} · {r.channelLabel}
              {open ? ` · hace ${r.daysOpen === 0 ? 'menos de un día' : r.daysOpen === 1 ? '1 día' : `${r.daysOpen} días`}` : ''}
            </Text>
            {r.details ? <Text variant="body">“{r.details}”</Text> : null}
          </View>
          {!r.customer.anonymized ? (
            <Button label="Ver ficha" variant="ghost" onPress={() => router.push(`/cliente/${r.customer.id}`)} />
          ) : null}
        </Card>
      </Appear>

      <Appear index={1}>
        <SectionHeader title="Qué hacer" />
        <Card style={{ marginTop: spacing.sm, gap: spacing.md }}>
          {r.type === 'ACCESS' ? (
            <>
              <Text variant="body">Genera un archivo con sus datos de contacto, consentimientos, citas y solicitudes. Compártelo solo con el cliente.</Text>
              <Button
                label="Exportar sus datos"
                icon={Download}
                variant="outline"
                requiresOnline
                loading={exporting.isPending}
                onPress={() => exporting.mutate(r.customer.id, { onSuccess: () => feedback.toast('Archivo generado'), onError: (e) => feedback.toast(e.message, 'error') })}
              />
            </>
          ) : null}
          {r.type === 'RECTIFICATION' ? (
            <>
              <Text variant="body">Corrige los datos en la ficha del cliente y después marca la solicitud como atendida.</Text>
              {!r.customer.anonymized ? <Button label="Abrir ficha" icon={PencilLine} variant="outline" onPress={() => router.push(`/cliente/${r.customer.id}`)} /> : null}
            </>
          ) : null}
          {r.type === 'OPPOSITION' ? <Text variant="body">Al marcarla como atendida se registra su baja de promociones. Seguirá recibiendo avisos de sus citas.</Text> : null}
          {r.type === 'CANCELLATION' ? (
            r.customer.anonymized ? (
              <Note title="Datos eliminados" body="Se conservan citas e importes sin identificar a la persona. Ya puedes marcar la solicitud como atendida." />
            ) : (
              <>
                <Text variant="body">Verifica la identidad de quien lo pide. Si tiene citas próximas, cancélalas primero.</Text>
                {open ? <Button label="Eliminar datos del cliente" icon={Eraser} variant="destructive" requiresOnline loading={anonymize.isPending} onPress={eraseData} /> : null}
              </>
            )
          ) : null}
          {r.completionBlocker ? <Note tone="warning" body={r.completionBlocker} /> : null}
        </Card>
      </Appear>

      {open ? (
        <Appear index={2}>
          <View style={{ gap: spacing.sm }}>
            {r.allowedActions.includes('start') ? (
              <Button label="Marcar en proceso" icon={PlayCircle} variant="outline" requiresOnline loading={transition.isPending && transition.variables?.action === 'start'} onPress={() => void run('start')} />
            ) : null}
            <Button label="Marcar como atendida" icon={CheckCircle2} requiresOnline disabled={!!r.completionBlocker} loading={transition.isPending && transition.variables?.action === 'complete'} onPress={() => void run('complete')} />
            <Button label="Rechazar" icon={XCircle} variant="ghost" requiresOnline onPress={() => void run('reject')} />
          </View>
        </Appear>
      ) : r.resolution ? (
        <Note title={r.status === 'COMPLETED' ? 'Respuesta' : 'Motivo del rechazo'} body={r.resolution} />
      ) : null}

      <Appear index={3}>
        <SectionHeader title="Historial" />
        <Card style={{ marginTop: spacing.sm }}>
          {r.history.map((h, i) => (
            <View key={`${h.at}-${i}`} style={{ paddingVertical: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border, gap: 2 }}>
              <Text variant="bodyStrong">{h.statusLabel}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {fmt.shortDay(h.at, tz)} · {fmt.time(h.at, tz)} · {h.actorName}
              </Text>
              {h.note ? <Text variant="caption">{h.note}</Text> : null}
            </View>
          ))}
        </Card>
      </Appear>
    </Screen>
  );
}
