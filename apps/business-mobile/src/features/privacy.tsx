import type { ConsentEvent, ConsentStatus, PrivacyRequest, PrivacyRequestStatus, PrivacyRequestType } from '@orion/contracts';
import { CONSENT_STATUS_LABELS } from '@orion/contracts';
import { router } from 'expo-router';
import { Eraser, FileSearch, FileText, PencilLine, ShieldOff, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { fmt } from '@/lib/format';
import { Badge, type BadgeTone, colors, ListRow, spacing, Text } from '@/ui';

export const consentTone: Record<ConsentStatus, BadgeTone> = { GRANTED: 'success', NOT_GRANTED: 'neutral', REVOKED: 'danger' };
export const requestTone: Record<PrivacyRequestStatus, BadgeTone> = { RECEIVED: 'warning', IN_PROGRESS: 'primary', COMPLETED: 'success', REJECTED: 'neutral' };
export const requestIcon: Record<PrivacyRequestType, LucideIcon> = { ACCESS: FileSearch, RECTIFICATION: PencilLine, CANCELLATION: Eraser, OPPOSITION: ShieldOff };

export function ConsentBadge({ status }: { status: ConsentStatus }) {
  return <Badge label={CONSENT_STATUS_LABELS[status]} tone={consentTone[status]} />;
}

/** Fila de solicitud: tipo, cliente, canal y días desde que se recibió. */
export function PrivacyRequestRow({ r, last }: { r: PrivacyRequest; last?: boolean }) {
  const open = r.status === 'RECEIVED' || r.status === 'IN_PROGRESS';
  return (
    <ListRow
      icon={requestIcon[r.type]}
      iconTone={open ? 'warning' : 'neutral'}
      title={`${r.typeLabel} · ${r.customer.name}`}
      subtitle={open ? `${r.channelLabel} · hace ${r.daysOpen === 0 ? 'menos de un día' : r.daysOpen === 1 ? '1 día' : `${r.daysOpen} días`}` : `${r.channelLabel} · ${r.statusLabel.toLowerCase()}`}
      accessory={<Badge label={r.statusLabel} tone={requestTone[r.status]} />}
      onPress={() => router.push(`/privacidad/${r.id}`)}
      last={last}
    />
  );
}

/** Historial de consentimiento: qué, cuándo, quién y con qué constancia. */
export function ConsentHistory({ events, tz, withCustomer }: { events: Array<ConsentEvent & { customerName?: string }>; tz: string; withCustomer?: boolean }) {
  if (events.length === 0) {
    return (
      <Text variant="caption" color={colors.textMuted} style={{ paddingVertical: spacing.md }}>
        Sin cambios registrados.
      </Text>
    );
  }
  return (
    <View>
      {events.map((e, i) => (
        <View key={e.id} style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
          <View style={{ width: 4, borderRadius: 2, backgroundColor: e.status === 'GRANTED' ? colors.success : e.status === 'REVOKED' ? colors.danger : colors.neutral }} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong">{withCustomer && e.customerName ? `${e.customerName} · ${e.statusLabel}` : e.statusLabel}</Text>
            <Text variant="caption" color={colors.textMuted}>
              {fmt.shortDay(e.at, tz)} · {e.sourceLabel} · {e.actorName}
            </Text>
            {e.evidence ? (
              <Text variant="caption" color={colors.textMuted} style={{ fontStyle: 'italic' }}>
                “{e.evidence}”
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

export function PendingPolicies({ items }: { items: string[] }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <FileText size={16} color={colors.accentInk} />
        <Text variant="captionStrong" color={colors.accentInk}>
          Pendiente de revisión especializada antes del piloto
        </Text>
      </View>
      {items.map((t) => (
        <Text key={t} variant="caption" color={colors.textMuted}>
          • {t}
        </Text>
      ))}
    </View>
  );
}
