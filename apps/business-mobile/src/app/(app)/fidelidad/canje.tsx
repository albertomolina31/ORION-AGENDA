import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowRight, CalendarDays, Camera, Check, CircleCheck, FileText, Info, Search, Star } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { endpoints } from '@/lib/endpoints';
import { fmt, localDate, noonOf } from '@/lib/format';
import { useIdempotentMutation } from '@/lib/mutations';
import { useBusiness } from '@/lib/session';
import {
  Avatar,
  Badge,
  Button,
  Card,
  colors,
  EmptyState,
  ErrorState,
  IconCircle,
  Ori,
  LinkButton,
  Note,
  radius,
  Screen,
  SkeletonList,
  spacing,
  StackHeader,
  Text,
  useFeedback,
} from '@/ui';
import { themed } from '@/ui';

/**
 * Validar canje. Escanear solo identifica la tarjeta; el canje lo autoriza el servidor
 * (idempotente: dos personas canjeando a la vez producen un solo canje).
 */
export default function Redeem() {
  const m = useBusiness();
  const members = useQuery({ queryKey: ['loyalty-members', m.businessId], queryFn: () => endpoints.loyaltyMemberships(m.businessId) });
  const withReward = (members.data ?? []).filter((x) => x.availableRewards.some((r) => r.status === 'AVAILABLE'));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const feedback = useFeedback();
  const member = withReward.find((x) => x.id === selectedId) ?? withReward[0];
  const reward = member?.availableRewards.find((r) => r.status === 'AVAILABLE');
  const customer = useQuery({
    queryKey: ['customer', m.businessId, member?.customerId],
    queryFn: () => endpoints.customer(m.businessId, member!.customerId),
    enabled: !!member,
  });
  const next = customer.data?.nextAppointment;

  const redeem = useIdempotentMutation(
    (_: void, requestId) => endpoints.redeem(m.businessId, { requestId, rewardId: reward!.id, appointmentId: next?.appointmentId ?? null }),
    [['loyalty-members', m.businessId], ['membership', m.businessId]],
  );

  return (
    <Screen
      header={<StackHeader title="Validar canje" subtitle={m.businessName} />}
      footer={
        reward && !done ? (
          <View style={{ gap: spacing.xs }}>
            <Button requiresOnline
              label="Confirmar canje"
              trailingIcon={ArrowRight}
              loading={redeem.isPending}
              onPress={() => {
                setError(null);
                redeem.mutate(undefined, {
                  onSuccess: (r) => {
                    setDone(r.redeemedAt);
                    feedback.celebrate('¡Recompensa canjeada!', `${member!.customerName} · ${reward!.description}`);
                  },
                  onError: (e) => setError(e.uncertain ? 'No sabemos si se registró el canje. Intenta de nuevo: no se duplicará.' : e.message),
                });
              }}
            />
            <LinkButton label="Cancelar" onPress={() => router.back()} chevron={false} />
          </View>
        ) : undefined
      }
    >
      <View style={{ gap: 2 }}>
        <Text variant="heading">Revisa la recompensa</Text>
        <Text variant="body" color={colors.textMuted}>
          Confirma los datos antes de utilizarla.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <OutlineAction icon={Camera} label="Escanear tarjeta" disabled />
        <OutlineAction icon={Search} label="Buscar cliente" onPress={() => setPicking(!picking)} />
      </View>
      <Text variant="caption" color={colors.textMuted} align="center">
        Escanear identifica la tarjeta; no realiza el canje. (Cámara disponible en una versión posterior.)
      </Text>

      {members.isLoading ? <SkeletonList rows={2} /> : null}
      {members.error ? <ErrorState error={members.error} onRetry={() => members.refetch()} /> : null}
      {members.data && withReward.length === 0 ? <EmptyState pose="star" title="Nadie tiene recompensas disponibles" body="Cuando un miembro complete su meta aparecerá aquí." /> : null}

      {picking ? (
        <Card padded={false}>
          {withReward.map((x, i) => (
            <Pressable
              key={x.id}
              onPress={() => {
                setSelectedId(x.id);
                setPicking(false);
                setDone(null);
                redeem.resetKey();
              }}
              style={[styles.pick, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
              accessibilityRole="button"
            >
              <Text variant="subheading">{x.customerName}</Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {member && reward ? (
        <>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
              <Avatar initials={member.customerName.split(' ').map((w) => w[0]).slice(0, 2).join('')} colorKey="lavender" size={56} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading">{member.customerName}</Text>
                <Text variant="body" color={colors.textMuted}>
                  Miembro del programa
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <CircleCheck size={18} color={colors.success} />
                  <Text variant="caption" color={colors.textMuted}>
                    Membresía identificada
                  </Text>
                </View>
              </View>
            </View>
          </Card>

          <Card tone="warning">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
              <IconCircle icon={Star} tone="warning" size={44} />
              <View style={{ flex: 1 }}>
                <Text variant="heading">{reward.description}</Text>
                <Text variant="body">En un {(reward.serviceName ?? 'servicio').toLowerCase()}</Text>
              </View>
              <Badge label={done ? 'Utilizada' : 'Disponible'} tone={done ? 'neutral' : 'success'} dot={false} />
            </View>
            <View style={styles.validRow}>
              <CalendarDays size={20} color={colors.textMuted} />
              <Text variant="body" color={colors.textMuted}>
                Válida hasta el {fmt.dayMonth(reward.validUntil, m.timezone)}
              </Text>
            </View>
          </Card>

          <Card>
            <View style={{ flexDirection: 'row', gap: spacing.lg }}>
              <IconCircle icon={CalendarDays} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="subheading">Aplicar en esta cita</Text>
                {next ? (
                  <>
                    <Text variant="bodyStrong">
                      {fmt.longDay(noonOf(localDate(next.startsAt, m.timezone)), 'UTC')} · {fmt.time(next.startsAt, m.timezone)}
                    </Text>
                    <Text variant="body" color={colors.textMuted}>
                      {next.serviceName} · Con {next.professionalName}
                    </Text>
                  </>
                ) : (
                  <Text variant="body" color={colors.textMuted}>
                    Sin cita próxima: el canje se registrará sin cita.
                  </Text>
                )}
              </View>
            </View>
          </Card>

          <Card>
            <View style={{ flexDirection: 'row', gap: spacing.lg }}>
              <IconCircle icon={FileText} size={40} />
              <View style={{ flex: 1, gap: spacing.sm }}>
                <Text variant="subheading">Condiciones del beneficio</Text>
                {[`Servicio elegible: ${(reward.serviceName ?? 'según programa').toLowerCase()}`, 'Un solo uso por recompensa', 'Vigencia verificada por el servidor'].map((t) => (
                  <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Check size={18} color={colors.primary} />
                    <Text variant="body">{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Card>

          {done ? (
            <Note icon={CircleCheck} title="Canje registrado" body={`Recompensa utilizada a las ${fmt.time(done, m.timezone)}.`} />
          ) : (
            <Note icon={Info} title="Al confirmar, la recompensa quedará utilizada." body="Esta acción no realiza un cobro ni un reembolso." />
          )}
          {error ? <Note tone="warning" body={error} /> : null}
          {!done ? (
            <Text variant="caption" color={colors.textMuted} align="center">
              El sistema volverá a validar su disponibilidad al confirmar.
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function OutlineAction({ icon: Icon, label, onPress, disabled }: { icon: typeof Camera; label: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.outline, disabled && { opacity: 0.5 }]}
    >
      <Icon size={24} color={colors.primary} />
      <Text variant="bodyStrong" color={colors.primary}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  outline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 60,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.surface,
  },
  pick: { padding: spacing.lg, minHeight: 56 },
  validRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.accentBorder },
}));
