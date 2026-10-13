import { appointmentStatusLabel } from '@orion/contracts';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, ChevronRight, Clock, FileText, MessageCircle, Plus, ShieldCheck, Star, User } from 'lucide-react-native';
import { ConsentBadge, ConsentHistory } from '@/features/privacy';
import { Pressable, StyleSheet, View } from 'react-native';
import { endpoints } from '@/lib/endpoints';
import { fmt, localDate, noonOf, relativeDayLabel } from '@/lib/format';
import { useCustomer, useHome } from '@/lib/queries';
import { useBusiness } from '@/lib/session';
import {
  Avatar,
  Button,
  Card,
  colors,
  Divider,
  ErrorState,
  IconCircle,
  LinkButton,
  LoadingState,
  Note,
  Screen,
  spacing,
  StackHeader,
  StampRow,
  StatusBadge,
  Text,
} from '@/ui';
import { themed } from '@/ui';

/** UI11 Ficha: contacto, preferencias, fidelidad e historial dentro de este negocio. */
export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const m = useBusiness();
  const q = useCustomer(id);
  const home = useHome();
  const loyalty = useQuery({
    queryKey: ['membership', m.businessId, id],
    queryFn: () => endpoints.membershipByCustomer(m.businessId, id),
    enabled: m.features.loyalty,
  });
  const c = q.data;
  const tz = m.timezone;
  const today = home.data?.date ?? '';
  const canCreate = m.permissions.includes('appointments.manage_all') || m.permissions.includes('appointments.manage_own');
  const canConsent = m.permissions.includes('customers.manage');
  const canPrivacy = m.permissions.includes('privacy.manage');

  if (q.isLoading) return <LoadingState />;
  if (q.error || !c)
    return (
      <Screen header={<StackHeader title={`Ficha del ${m.vocabulary.customerSingular.toLowerCase()}`} />}>
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </Screen>
    );

  const next = c.nextAppointment;
  const membership = loyalty.data?.membership;

  return (
    <Screen
      header={<StackHeader title={`Ficha del ${m.vocabulary.customerSingular.toLowerCase()}`} subtitle={m.businessName} />}
      onRefresh={() => {
        void q.refetch();
        void loyalty.refetch();
      }}
      refreshing={q.isRefetching}
      footer={canCreate && !c.anonymized ? <Button label="Agendar cita" icon={Plus} onPress={() => router.push(`/cita/nueva?customerId=${c.id}`)} /> : undefined}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <Avatar initials={c.initials} size={72} colorKey="lavender" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title">
            {c.name}
          </Text>
          <Text variant="body" color={colors.textMuted}>
            {m.vocabulary.customerSingular} desde {fmt.monthYearSince(c.customerSince, tz)}
          </Text>
        </View>
      </View>

      {c.anonymized ? (
        <Note title="Datos personales eliminados" body="Por solicitud del cliente. Se conservan sus citas e importes sin identificarlo." />
      ) : null}

      {c.possibleDuplicates.length > 0 ? (
        <Note tone="warning" title="Posible duplicado" body={`Revisa: ${c.possibleDuplicates.map((d) => d.name).join(', ')}. No se fusiona automáticamente.`} />
      ) : null}

      <View style={styles.stats}>
        <View style={styles.stat}>
          <IconCircle icon={CalendarDays} size={40} />
          <View>
            <Text variant="heading">{c.completedVisits}</Text>
            <Text variant="caption" color={colors.textMuted}>
              visitas completadas
            </Text>
          </View>
        </View>
        <View style={styles.vr} />
        <View style={styles.stat}>
          <IconCircle icon={Clock} size={40} />
          <Text variant="body" color={colors.textMuted} style={{ flexShrink: 1 }}>
            {c.lastVisitAt ? `Última visita · ${fmt.shortDay(c.lastVisitAt, tz)}` : 'Sin visitas aún'}
          </Text>
        </View>
      </View>

      {next ? (
        <Card tone="accent" onPress={() => router.push(`/cita/${next.appointmentId}`)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="title">Próxima cita</Text>
            <StatusBadge status={next.status} />
          </View>
          <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
            {relativeDayLabel(next.startsAt, tz, today) === 'Hoy'
              ? `Hoy, ${fmt.dayMonth(noonOf(localDate(next.startsAt, tz)), 'UTC')}`
              : fmt.longDay(noonOf(localDate(next.startsAt, tz)), 'UTC')}
          </Text>
          <Text variant="display">{fmt.time(next.startsAt, tz)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="body" color={colors.textMuted}>
              {next.serviceName} · Con {next.professionalName}
            </Text>
            <Text variant="bodyStrong" color={colors.primary}>
              Ver cita ›
            </Text>
          </View>
        </Card>
      ) : null}

      <Card>
        <Text variant="heading">Preferencias de atención</Text>
        <PrefRow icon={User} label="Profesional preferido" value={c.preferredProfessional?.name ?? 'Sin preferencia'} />
        <Divider />
        <PrefRow icon={FileText} label={`Nota del ${m.vocabulary.customerSingular.toLowerCase()}`} value={c.note ?? 'Sin notas'} />
      </Card>

      {m.features.loyalty ? (
        <Card onPress={() => router.push('/marketing')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <IconCircle icon={Star} tone="warning" size={44} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="subheading">Fidelidad</Text>
              <Text variant="caption" color={colors.textMuted}>
                {loyalty.isLoading
                  ? 'Consultando…'
                  : membership
                    ? `${membership.stamps} de ${membership.stampsRequired} sellos${membership.passUpdate === 'PENDING' ? ' · tarjeta pendiente de actualizar' : ''}`
                    : 'Sin membresía en el programa'}
              </Text>
            </View>
            {membership ? <StampRow filled={membership.stamps} total={membership.stampsRequired} size={18} /> : null}
            <ChevronRight size={20} color={colors.text} />
          </View>
        </Card>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="title">Historial de visitas</Text>
        </View>
        <Card padded={false}>
          {c.history.length === 0 ? (
            <Text variant="body" color={colors.textMuted} style={{ padding: spacing.lg }}>
              Aún no hay visitas registradas.
            </Text>
          ) : null}
          {c.history.slice(0, 6).map((h, i) => (
            <Pressable key={h.appointmentId} onPress={() => router.push(`/cita/${h.appointmentId}`)} accessibilityRole="button" style={[styles.histRow, i > 0 && styles.divider]}>
              <IconCircle icon={CalendarDays} size={36} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">
                  {fmt.shortDay(h.startsAt, tz)} · {h.serviceName}
                </Text>
                <Text variant="caption" color={colors.textMuted}>
                  {h.professionalName} · {appointmentStatusLabel[h.status]}
                </Text>
              </View>
              <ChevronRight size={20} color={colors.text} />
            </Pressable>
          ))}
        </Card>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <IconCircle icon={MessageCircle} size={40} />
          <View style={{ flex: 1 }}>
            <Text variant="subheading">Contacto y privacidad</Text>
            <Text variant="caption" color={colors.textMuted}>
              {c.phone ?? c.phoneMasked ?? 'Sin teléfono'}
              {c.email ? ` · ${c.email}` : ''}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
          <Text variant="bodyStrong">Promociones por WhatsApp</Text>
          <ConsentBadge status={c.promotionalConsent} />
        </View>
        {c.consentHistory.length > 0 ? <ConsentHistory events={c.consentHistory.slice(0, 3)} tz={tz} /> : null}
        {!c.anonymized && (canConsent || canPrivacy) ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            {canConsent ? (
              <Button
                label={c.promotionalConsent === 'GRANTED' ? 'Registrar baja de promociones' : 'Registrar consentimiento'}
                variant="outline"
                onPress={() => router.push(`/cliente/consentimiento?id=${c.id}`)}
              />
            ) : null}
            {canPrivacy ? <Button label="Registrar solicitud de datos" icon={ShieldCheck} variant="ghost" onPress={() => router.push(`/privacidad/nueva?customerId=${c.id}`)} /> : null}
          </View>
        ) : null}
      </Card>
      <LinkButton label="Volver a la lista" onPress={() => router.back()} chevron={false} />
    </Screen>
  );
}

function PrefRow({ icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <IconCircle icon={icon} size={44} />
      <Text variant="body" color={colors.textMuted} style={{ width: 130 }}>
        {label}
      </Text>
      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {value}
      </Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  stats: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  vr: { width: 1, height: 48, backgroundColor: colors.border },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
}));
