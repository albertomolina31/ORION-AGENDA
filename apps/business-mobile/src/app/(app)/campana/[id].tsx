import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Ban, CalendarDays, CircleCheck, CircleX, MessageCircle, Pause, Play, Send, Users } from 'lucide-react-native';
import { View } from 'react-native';
import { endpoints } from '@/lib/endpoints';
import { fmt } from '@/lib/format';
import { useIdempotentMutation } from '@/lib/mutations';
import { useBusiness } from '@/lib/session';
import {
  AnimatedNumber,
  Appear,
  Button,
  CampaignBadge,
  Card,
  colors,
  Divider,
  ErrorState,
  IconCircle,
  LoadingState,
  Note,
  Ori,
  Screen,
  spacing,
  StackHeader,
  Text,
  useFeedback,
} from '@/ui';

const segmentLabel = { INACTIVE: 'Clientes sin visita reciente', FREQUENT: 'Clientes frecuentes', NEAR_REWARD: 'Próximos a recompensa' } as const;

/**
 * UI24 Detalle y resultados de campaña. Solo muestra métricas realmente disponibles;
 * pausar o cancelar impide envíos futuros pero no retira mensajes ya enviados.
 */
export default function CampaignDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const m = useBusiness();
  const feedback = useFeedback();
  const q = useQuery({ queryKey: ['campaign', m.businessId, id], queryFn: () => endpoints.campaign(m.businessId, id) });
  const templates = useQuery({ queryKey: ['templates', m.businessId], queryFn: () => endpoints.templates(m.businessId) });
  const action = useIdempotentMutation(
    (a: 'pause' | 'resume' | 'cancel', requestId) => endpoints.campaignAction(m.businessId, id, a, requestId),
    [['campaigns', m.businessId], ['campaign', m.businessId, id]],
  );
  const c = q.data;
  const canManage = m.permissions.includes('campaigns.manage');

  if (q.isLoading) return <LoadingState />;
  if (q.error || !c)
    return (
      <Screen header={<StackHeader title="Campaña" />}>
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </Screen>
    );

  const tz = m.timezone;
  const template = templates.data?.find((t) => t.id === c.content?.templateId);
  const run = async (a: 'pause' | 'resume' | 'cancel') => {
    const copy = {
      pause: { title: 'Pausar campaña', message: 'No se enviarán más mensajes hasta que la reanudes. Los ya enviados no se retiran.', label: 'Pausar' },
      resume: { title: 'Reanudar campaña', message: 'Volverá a quedar programada. Revalidaremos destinatarios antes de enviar.', label: 'Reanudar' },
      cancel: { title: 'Cancelar campaña', message: 'Impide cualquier envío futuro. Los mensajes ya enviados no se pueden retirar. No se puede deshacer.', label: 'Cancelar campaña' },
    }[a];
    const r = await feedback.confirm({ title: copy.title, message: copy.message, confirmLabel: copy.label, destructive: a === 'cancel' });
    if (!r.confirmed) return;
    action.mutate(a, {
      onSuccess: () => feedback.toast({ pause: 'Campaña pausada', resume: 'Campaña reanudada', cancel: 'Campaña cancelada' }[a]),
      onError: (e) => {
        action.resetKey();
        feedback.toast(e.message, 'error');
      },
    });
  };

  const res = c.results;
  return (
    <Screen header={<StackHeader title="Campaña" subtitle={m.businessName} />} onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Appear>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="title" style={{ flex: 1 }}>
            {c.name}
          </Text>
          <CampaignBadge status={c.status} />
        </View>
        <Text variant="caption" color={colors.textMuted}>
          WhatsApp ·{' '}
          {c.status === 'FINISHED' && c.sentAt
            ? `Enviada el ${fmt.shortDay(c.sentAt, tz)} a las ${fmt.time(c.sentAt, tz)}`
            : c.scheduledAt
              ? `Programada para el ${fmt.shortDay(c.scheduledAt, tz)} a las ${fmt.time(c.scheduledAt, tz)}`
              : 'Sin programar'}
        </Text>
      </Appear>

      {res ? (
        <Appear index={1}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Metric icon={Send} label="Enviados" value={res.sent} />
            <Metric icon={CircleCheck} label="Entregados" value={res.delivered} tone="success" />
            <Metric icon={CircleX} label="Con error" value={res.failed} tone="warning" />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <Metric icon={MessageCircle} label="Respuestas" value={res.replies} />
            <Metric icon={CalendarDays} label="Reservas atribuibles" value={res.attributedBookings} />
          </View>
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
            "Aceptado por el proveedor" no equivale a entregado ni leído. Las reservas atribuibles se mostrarán cuando definamos enlace y ventana de atribución.
          </Text>
        </Appear>
      ) : (
        <Appear index={1}>
          <Card tone="muted">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Ori pose="whatsapp" size={64} float={false} />
              <View style={{ flex: 1 }}>
                <Text variant="subheading">{c.status === 'CANCELLED' ? 'Campaña cancelada' : 'Aún sin envíos'}</Text>
                <Text variant="caption" color={colors.textMuted}>
                  {c.status === 'CANCELLED' ? 'No se enviará a nadie más.' : 'Los resultados aparecerán al iniciar el envío.'}
                </Text>
              </View>
            </View>
          </Card>
        </Appear>
      )}

      <Appear index={2}>
        <Card>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <IconCircle icon={Users} size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subheading">Audiencia</Text>
              <Text variant="body">{c.eligibleCount !== null ? `${c.eligibleCount} destinatarios elegibles` : 'Sin calcular'}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {c.audience?.mode === 'SEGMENT'
                  ? `${segmentLabel[c.audience.segment]}${c.audience.segment === 'INACTIVE' ? ` · más de ${c.audience.inactiveDays} días` : ''}${c.audience.excludeWithUpcoming ? ' · sin próxima cita' : ''}`
                  : c.audience?.mode === 'MANUAL'
                    ? `Selección manual · ${c.audience.customerIds.length} personas`
                    : 'Sin audiencia'}
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                La elegibilidad se revalida antes de cada envío; las bajas siempre prevalecen.
              </Text>
            </View>
          </View>
          {c.content ? (
            <>
              <Divider />
              <View style={{ flexDirection: 'row', gap: spacing.md, paddingTop: spacing.md }}>
                <IconCircle icon={MessageCircle} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="subheading">Mensaje</Text>
                  <Text variant="body">{template?.name ?? 'Plantilla'}</Text>
                  <Text variant="caption" color={colors.textMuted}>
                    {c.content.benefit} · {c.content.validUntil}
                  </Text>
                </View>
              </View>
            </>
          ) : null}
        </Card>
      </Appear>

      <Appear index={3}>
        <Text variant="subheading" style={{ marginBottom: spacing.sm }}>
          Historial
        </Text>
        <Card>
          {c.timeline.map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.xs + 2 }}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i === c.timeline.length - 1 ? colors.primary : colors.primaryBorder, marginTop: 4 }} />
                {i < c.timeline.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: colors.primarySoft, marginTop: 2 }} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: spacing.xs }}>
                <Text variant="bodyStrong">{t.label}</Text>
                <Text variant="caption" color={colors.textMuted}>
                  {fmt.shortDay(t.at, tz)} · {fmt.time(t.at, tz)}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      </Appear>

      {canManage ? (
        <View style={{ gap: spacing.sm }}>
          {c.status === 'DRAFT' ? <Button label="Continuar editando" onPress={() => router.replace(`/campana/nueva?id=${c.id}`)} /> : null}
          {c.status === 'SCHEDULED' || c.status === 'SENDING' ? <Button requiresOnline label="Pausar" icon={Pause} variant="outline" loading={action.isPending} onPress={() => run('pause')} /> : null}
          {c.status === 'PAUSED' ? <Button requiresOnline label="Reanudar" icon={Play} loading={action.isPending} onPress={() => run('resume')} /> : null}
          {['DRAFT', 'SCHEDULED', 'SENDING', 'PAUSED'].includes(c.status) ? (
            <Button requiresOnline label="Cancelar campaña" icon={Ban} variant="destructive" disabled={action.isPending} onPress={() => run('cancel')} />
          ) : null}
        </View>
      ) : (
        <Note body="Solo lectura: tu rol no permite gestionar campañas." />
      )}
    </Screen>
  );
}

function Metric({ icon, label, value, tone = 'primary' }: { icon: typeof Send; label: string; value: number | null; tone?: 'primary' | 'success' | 'warning' }) {
  return (
    <Card style={{ flex: 1, gap: 2 }}>
      <IconCircle icon={icon} tone={tone} size={30} />
      {value === null ? (
        <Text variant="bodyStrong" color={colors.textSubtle}>
          No disponible
        </Text>
      ) : (
        <AnimatedNumber value={value} variant="title" />
      )}
      <Text variant="caption" color={colors.textMuted} numberOfLines={2}>
        {label}
      </Text>
    </Card>
  );
}
