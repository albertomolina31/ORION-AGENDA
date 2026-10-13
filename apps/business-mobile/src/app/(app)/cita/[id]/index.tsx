import type { AppointmentAction } from '@orion/contracts';
import { appointmentSourceLabel, appointmentStatusLabel } from '@orion/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { Ban, CalendarClock, Check, CircleCheck, Clock, UserX, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { endpoints } from '@/lib/endpoints';
import { fmt, noonOf, localDate } from '@/lib/format';
import { useIdempotentMutation } from '@/lib/mutations';
import { useAppointment } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import {
  Avatar,
  Badge,
  Button,
  Card,
  colors,
  Divider,
  ErrorState,
  LoadingState,
  Note,
  Screen,
  spacing,
  StackHeader,
  StatusBadge,
  Text,
  useFeedback,
} from '@/ui';

type Action = Exclude<AppointmentAction, 'reschedule'>;

const actionCopy: Record<Action, { label: string; confirm: string; done: string }> = {
  approve: { label: 'Aprobar', confirm: '¿Aprobar esta solicitud? Se confirmará la cita.', done: 'Cita confirmada.' },
  reject: { label: 'Rechazar', confirm: '¿Rechazar esta solicitud? El horario quedará libre.', done: 'Solicitud rechazada.' },
  cancel: { label: 'Cancelar cita', confirm: '¿Cancelar esta cita? El horario quedará libre.', done: 'Cita cancelada.' },
  complete: { label: 'Marcar como completada', confirm: '¿Confirmas que el servicio se atendió?', done: 'Visita completada.' },
  'no-show': { label: 'No asistió', confirm: '¿Registrar que la persona no asistió?', done: 'Ausencia registrada.' },
};

/** UI07 Detalle: estado, cliente, servicio, profesional, hora y origen; acciones según permisos y estado. */
export default function AppointmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const m = useBusiness();
  const q = useAppointment(id);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const feedback = useFeedback();

  const mutation = useIdempotentMutation(
    ({ action, version, reason: r }: { action: Action; version: number; reason?: string }, requestId) =>
      endpoints.transition(m.businessId, id, action, { requestId, expectedVersion: version, reason: r || undefined }),
    [['appointment', m.businessId, id], ['agenda', m.businessId], ['home', m.businessId], ['customer', m.businessId]],
  );

  const a = q.data;
  const run = async (action: Action, requireReason = false) => {
    if (!a) return;
    const answer = await feedback.confirm({
      title: actionCopy[action].label,
      message: requireReason ? `${actionCopy[action].confirm} Está fuera del plazo de la política: indica el motivo.` : actionCopy[action].confirm,
      confirmLabel: actionCopy[action].label,
      destructive: action === 'cancel' || action === 'reject' || action === 'no-show',
      requireReason,
      reasonLabel: 'Motivo de la excepción (obligatorio)',
    });
    if (!answer.confirmed) return;
    setMessage(null);
    mutation.mutate(
      { action, version: a.version, reason: answer.reason },
      {
        onSuccess: () => {
          if (action === 'complete') feedback.celebrate('¡Visita completada!', `${a.customer.name} · ${a.service.name}`);
          else feedback.toast(actionCopy[action].done);
        },
        onError: (err) => {
          if (err.code === 'POLICY_VIOLATION' && err.details?.['requiresReason']) {
            mutation.resetKey();
            void run(action, true);
            return;
          }
          if (err.code === 'STALE_VERSION') void q.refetch();
          setMessage({
            tone: 'error',
            text: err.uncertain ? 'No sabemos si se aplicó el cambio. Revisa el estado antes de intentar de nuevo.' : err.message,
          });
        },
      },
    );
  };

  if (q.isLoading) return <LoadingState />;
  if (q.error || !a)
    return (
      <Screen header={<StackHeader title="Cita" />}>
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </Screen>
    );

  const tz = a.timezone;
  const can = (x: AppointmentAction) => a.allowedActions.includes(x);
  const day = localDate(a.startsAt, tz);

  return (
    <Screen header={<StackHeader title="Detalle de la cita" subtitle={m.businessName} />} onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Card tone="accent">
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="body" color={colors.textMuted}>
              {fmt.longDay(noonOf(day), 'UTC')}
            </Text>
            <StatusBadge status={a.status} />
          </View>
          <Text variant="display">{fmt.range(a.startsAt, a.endsAt, tz)}</Text>
          <Text variant="body" color={colors.textMuted}>
            {a.service.name} · {a.service.durationMin} min · {fmt.money(a.service.price)}
          </Text>
          <Text variant="micro" color={colors.textSubtle}>
            Horario del negocio ({tz})
          </Text>
        </View>
      </Card>

      {a.status === 'PENDING_APPROVAL' && a.expiresAt ? (
        <Note icon={Clock} tone="warning" title="Solicitud pendiente de aprobación" body={`Vence a las ${fmt.time(a.expiresAt, tz)}. Si no se aprueba, el horario se libera.`} />
      ) : null}

      <Card>
        <Row label={m.vocabulary.customerSingular} value={a.customer.name} onPress={() => router.push(`/cliente/${a.customer.id}`)} extra={a.customer.firstVisit ? <Badge label="Primera atención" tone="primary" dot={false} /> : null} />
        <Divider />
        <View style={styles.row}>
          <Text variant="body" color={colors.textMuted} style={{ width: 110 }}>
            Profesional
          </Text>
          <Avatar initials={a.professional.initials} colorKey={a.professional.colorKey} size={36} />
          <Text variant="bodyStrong">{a.professional.name}</Text>
        </View>
        <Divider />
        <Row label="Origen" value={appointmentSourceLabel[a.source]} />
        {a.customerNotice !== 'NOT_APPLICABLE' ? (
          <>
            <Divider />
            <Row label="Aviso al cliente" value={{ PENDING: 'Pendiente', SENT: 'Enviado', DELIVERED: 'Entregado', FAILED: 'Falló el envío', NOT_APPLICABLE: '' }[a.customerNotice]} />
          </>
        ) : null}
      </Card>

      {message ? (
        <Note icon={message.tone === 'success' ? CircleCheck : X} tone={message.tone === 'success' ? 'info' : 'warning'} body={message.text} />
      ) : null}


      <View style={{ gap: spacing.md }}>
        {can('approve') ? <Button label="Aprobar" icon={Check} onPress={() => run('approve')} loading={mutation.isPending} /> : null}
        {can('reject') ? <Button label="Rechazar" icon={X} variant="destructive" onPress={() => run('reject')} disabled={mutation.isPending} /> : null}
        {can('complete') ? <Button label="Marcar como completada" icon={CircleCheck} onPress={() => run('complete')} loading={mutation.isPending} /> : null}
        {can('reschedule') ? (
          <Button label="Reprogramar" icon={CalendarClock} variant="outline" onPress={() => router.push(`/cita/${a.id}/reprogramar`)} disabled={mutation.isPending} />
        ) : null}
        {can('no-show') ? <Button label="No asistió" icon={UserX} variant="outline" onPress={() => run('no-show')} disabled={mutation.isPending} /> : null}
        {can('cancel') ? <Button label="Cancelar cita" icon={Ban} variant="destructive" onPress={() => run('cancel')} disabled={mutation.isPending} /> : null}
        {a.allowedActions.length === 0 ? (
          <Text variant="caption" color={colors.textMuted} align="center">
            {a.status === 'CONFIRMED' || a.status === 'PENDING_APPROVAL'
              ? 'No tienes acciones disponibles sobre esta cita.'
              : `Esta cita está ${appointmentStatusLabel[a.status].toLowerCase()} y ya no admite cambios.`}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="subheading">Historial</Text>
        <Card>
          {a.history.map((h, i) => (
            <View key={i} style={{ paddingVertical: spacing.sm, gap: 2 }}>
              <Text variant="bodyStrong">
                {h.fromStatus ? `${appointmentStatusLabel[h.fromStatus]} → ` : ''}
                {appointmentStatusLabel[h.toStatus]}
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                {fmt.shortDay(h.at, tz)} · {fmt.time(h.at, tz)} · {h.actorName}
                {h.reason ? ` · “${h.reason}”` : ''}
              </Text>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}

function Row({ label, value, onPress, extra }: { label: string; value: string; onPress?: () => void; extra?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text variant="body" color={colors.textMuted} style={{ width: 110 }}>
        {label}
      </Text>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="bodyStrong" color={onPress ? colors.primary : colors.text} onPress={onPress} accessibilityRole={onPress ? 'link' : undefined}>
          {value}
        </Text>
        {extra}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
});
