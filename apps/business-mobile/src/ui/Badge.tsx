import type { AppointmentStatus, CampaignStatus } from '@orion/contracts';
import { appointmentStatusLabel, campaignStatusLabel } from '@orion/contracts';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing } from './theme';

export type BadgeTone = 'success' | 'warning' | 'neutral' | 'primary' | 'danger';

const tones: Record<BadgeTone, { bg: string; fg: string; dot: string }> = {
  success: { bg: colors.successSoft, fg: '#17683A', dot: colors.success },
  warning: { bg: colors.accentSoft, fg: colors.accentInk, dot: colors.accent },
  neutral: { bg: colors.neutralSoft, fg: colors.neutral, dot: colors.neutral },
  primary: { bg: colors.primarySoftStrong, fg: colors.primaryPressed, dot: colors.primary },
  danger: { bg: colors.dangerSoft, fg: colors.danger, dot: colors.danger },
};

/** Estado siempre con texto además del color. */
export function Badge({ label, tone = 'neutral', dot = true }: { label: string; tone?: BadgeTone; dot?: boolean }) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]} accessibilityLabel={label}>
      {dot ? <View style={[styles.dot, { backgroundColor: t.dot }]} /> : null}
      <Text variant="captionStrong" color={t.fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export const appointmentTone: Record<AppointmentStatus, BadgeTone> = {
  CONFIRMED: 'success',
  PENDING_APPROVAL: 'warning',
  COMPLETED: 'primary',
  CANCELLED: 'neutral',
  REJECTED: 'neutral',
  EXPIRED: 'neutral',
  NO_SHOW: 'danger',
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge label={appointmentStatusLabel[status]} tone={appointmentTone[status]} />;
}

const campaignTone: Record<CampaignStatus, BadgeTone> = {
  DRAFT: 'neutral',
  SCHEDULED: 'primary',
  SENDING: 'primary',
  PAUSED: 'warning',
  FINISHED: 'success',
  CANCELLED: 'neutral',
};

export function CampaignBadge({ status }: { status: CampaignStatus }) {
  return <Badge label={campaignStatusLabel[status]} tone={campaignTone[status]} dot={false} />;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
