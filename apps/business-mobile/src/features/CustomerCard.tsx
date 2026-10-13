import type { CustomerSummary } from '@orion/contracts';
import { router } from 'expo-router';
import { CalendarDays, ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { fmt, localDate, relativeDayLabel } from '@/lib/format';
import { Avatar, Badge, colors, PressableScale, radius, shadow, spacing, StatusBadge, Text } from '@/ui';
import { themed } from '@/ui';

export function CustomerCard({
  customer,
  tz,
  today,
  variant = 'directory',
}: {
  customer: CustomerSummary;
  tz: string;
  today: string;
  variant?: 'directory' | 'firstVisit';
}) {
  const next = customer.nextAppointment;
  const nextLabel = next ? `${relativeDayLabel(next.startsAt, tz, today)} · ${fmt.time(next.startsAt, tz)}` : null;
  return (
    <PressableScale
      onPress={() => router.push(`/cliente/${customer.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${customer.name}${nextLabel ? `, próxima cita ${nextLabel}` : ', sin próxima cita'}`}
      scaleTo={0.98}
      style={styles.card}
    >
      <Avatar initials={variant === 'firstVisit' ? customer.initials : customer.initials.charAt(0)} seed={customer.name} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <Text variant="subheading" style={{ flex: 1 }} numberOfLines={1}>
            {customer.name}
          </Text>
          {variant === 'firstVisit' && next ? <StatusBadge status={next.status} /> : null}
        </View>
        {variant === 'firstVisit' ? (
          <>
            <Badge label="Primera atención" tone="primary" dot={false} />
            {next ? (
              <View style={styles.datePill}>
                <CalendarDays size={14} color={colors.primary} />
                <Text variant="captionStrong" color={colors.primary}>
                  {nextLabel}
                </Text>
              </View>
            ) : null}
            {next ? (
              <Text variant="caption" color={colors.textMuted}>
                {next.serviceName} · Con {next.professionalName}
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <Text variant="caption" color={colors.textMuted}>
              {customer.lastVisitAt ? `Última visita: ${fmt.shortDay(customer.lastVisitAt, tz)}` : 'Aún sin visitas completadas'}
            </Text>
            {next ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <CalendarDays size={14} color={colors.primary} />
                <Text variant="captionStrong" color={colors.primary}>
                  {localDate(next.startsAt, tz) === today ? `Hoy · ${fmt.time(next.startsAt, tz)}` : nextLabel}
                </Text>
              </View>
            ) : (
              <Text variant="caption" color={colors.textSubtle}>
                Sin próxima cita
              </Text>
            )}
          </>
        )}
      </View>
      <ChevronRight size={18} color={colors.textSubtle} />
    </PressableScale>
  );
}

const styles = themed(() => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
}));
