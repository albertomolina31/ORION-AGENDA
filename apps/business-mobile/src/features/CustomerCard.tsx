import type { CustomerSummary } from '@orion/contracts';
import { router } from 'expo-router';
import { CalendarDays, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { fmt, localDate, relativeDayLabel } from '@/lib/format';
import { Avatar, Badge, colors, radius, shadow, spacing, StatusBadge, Text } from '@/ui';

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
    <Pressable
      onPress={() => router.push(`/cliente/${customer.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${customer.name}${nextLabel ? `, próxima cita ${nextLabel}` : ', sin próxima cita'}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <Avatar initials={variant === 'firstVisit' ? customer.initials : customer.initials.charAt(0)} seed={customer.name} size={variant === 'firstVisit' ? 72 : 76} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <Text variant="subheading" style={{ flex: 1, fontSize: 19 }} numberOfLines={1}>
            {customer.name}
          </Text>
          {variant === 'firstVisit' && next ? <StatusBadge status={next.status} /> : null}
        </View>
        {variant === 'firstVisit' ? (
          <>
            <Badge label="Primera atención" tone="primary" dot={false} />
            {next ? (
              <View style={styles.datePill}>
                <CalendarDays size={18} color={colors.primary} />
                <Text variant="bodyStrong" color={colors.primary}>
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
            <Text variant="body" color={colors.textMuted}>
              {customer.lastVisitAt ? `Última visita: ${fmt.shortDay(customer.lastVisitAt, tz)}` : 'Aún sin visitas completadas'}
            </Text>
            {next ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <CalendarDays size={18} color={colors.primary} />
                <Text variant="bodyStrong" color={colors.primary}>
                  {localDate(next.startsAt, tz) === today ? `Hoy · ${fmt.time(next.startsAt, tz)}` : nextLabel}
                </Text>
              </View>
            ) : (
              <Text variant="body" color={colors.textSubtle}>
                Sin próxima cita
              </Text>
            )}
          </>
        )}
      </View>
      <ChevronRight size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
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
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
});
