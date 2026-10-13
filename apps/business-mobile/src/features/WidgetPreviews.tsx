import type { WidgetAppointment, WidgetSnapshot } from '@orion/contracts';
import { Lock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { colors, NightCard, Ori, proColor, radius, spacing, Text } from '@/ui';
import { themed } from '@/ui';

/**
 * Vista previa de los widgets de inicio, dibujada con los mismos datos de la instantánea
 * que leerá el widget nativo. Es una aproximación: el widget real se dibuja con SwiftUI
 * (iOS) y RemoteViews (Android) y no tiene animaciones continuas; por eso Ori va quieto.
 * Tamaños de referencia en puntos (iPhone 15/16): pequeño 170×170, mediano 364×170, grande 364×382.
 */
export const WIDGET_SIZES = { small: 170, mediumW: 364, mediumH: 170, largeH: 382 } as const;

function StaticOri({ pose, size }: { pose: WidgetSnapshot['oriPose'] | 'head'; size: number }) {
  return <Ori pose={pose} size={size} float={false} enter={false} interactive={false} />;
}

function Updated({ snapshot, stale, onNight }: { snapshot: WidgetSnapshot; stale?: boolean; onNight?: boolean }) {
  return (
    <Text variant="micro" color={stale ? colors.danger : onNight ? colors.textOnNightMuted : colors.textMuted} style={{ fontWeight: '500' }}>
      {stale ? 'Abre Orion para actualizar' : `Actualizado ${snapshot.generatedAtLabel}`}
    </Text>
  );
}

function StatusPill({ a }: { a: WidgetAppointment }) {
  const pending = a.status === 'PENDING_APPROVAL';
  return (
    <View style={[styles.pill, { backgroundColor: pending ? colors.accentSoft : colors.successSoft }]}>
      <View style={[styles.dot, { backgroundColor: pending ? colors.accent : colors.success }]} />
      <Text variant="micro" color={pending ? colors.accentInk : colors.success}>
        {a.statusLabel}
      </Text>
    </View>
  );
}

/** 01 · Próxima cita (pequeño). Al tocar: detalle de la cita. */
export function NextAppointmentWidget({ snapshot, stale }: { snapshot: WidgetSnapshot; stale?: boolean }) {
  const next = snapshot.upcoming[0];
  const hidden = snapshot.privacy === 'HIDDEN';
  return (
    <View style={[styles.lightCard, { width: WIDGET_SIZES.small, height: WIDGET_SIZES.small }]} accessibilityLabel="Vista previa: widget Próxima cita">
      <View style={styles.oriCorner}>
        <StaticOri pose={next ? 'head' : 'sleep'} size={46} />
      </View>
      <Text variant="micro" color={colors.textMuted} numberOfLines={1} style={{ marginRight: 40, fontWeight: '500' }}>
        {snapshot.businessName}
      </Text>
      {!next ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text variant="subheading">Sin próximas citas</Text>
          <Text variant="micro" color={colors.textMuted} style={{ fontWeight: '500' }}>
            Esta semana no hay más citas.
          </Text>
        </View>
      ) : hidden ? (
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xs }}>
          <Text variant="title" style={{ fontSize: 30, lineHeight: 34 }}>
            {next.timeLabel}
          </Text>
          <Text variant="captionStrong">{next.dayLabel === 'Hoy' ? 'Próxima cita' : `${next.dayLabel} · Próxima cita`}</Text>
          <View style={[styles.pill, { backgroundColor: colors.neutralSoft }]}>
            <Lock size={11} color={colors.textMuted} />
            <Text variant="micro" color={colors.textMuted}>
              Información oculta
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', gap: 2 }}>
          {next.dayLabel !== 'Hoy' ? (
            <Text variant="micro" color={colors.primary}>
              {next.dayLabel}
            </Text>
          ) : null}
          <Text variant="title" style={{ fontSize: 32, lineHeight: 36 }}>
            {next.timeLabel}
          </Text>
          <Text variant="captionStrong" numberOfLines={1}>
            {next.serviceName}
          </Text>
          <StatusPill a={next} />
          <Text variant="micro" color={colors.textMuted} numberOfLines={1} style={{ fontWeight: '500' }}>
            {next.customerLabel} · Con {next.professionalName}
          </Text>
        </View>
      )}
      <View style={styles.footerLine} />
      <Updated snapshot={snapshot} stale={stale} />
    </View>
  );
}

/** 02 · Agenda del día (mediano). Al tocar: agenda de hoy. */
export function DayAgendaWidget({ snapshot, stale }: { snapshot: WidgetSnapshot; stale?: boolean }) {
  const rows = snapshot.upcoming.filter((a) => a.date === snapshot.today).slice(0, 3);
  const hidden = snapshot.privacy === 'HIDDEN';
  return (
    <NightCard style={{ width: WIDGET_SIZES.mediumW, height: WIDGET_SIZES.mediumH, padding: spacing.lg, borderRadius: 22 }}>
      <View style={{ position: 'absolute', right: 6, bottom: 4 }}>
        <StaticOri pose={snapshot.oriPose} size={112} />
      </View>
      <View style={{ flex: 1, marginRight: 104 }} accessibilityLabel="Vista previa: widget Agenda del día">
        <Text variant="subheading" color={colors.textOnNight} numberOfLines={1}>
          Hoy · {snapshot.businessName}
        </Text>
        <View style={{ flex: 1, justifyContent: rows.length ? 'flex-start' : 'center', marginTop: spacing.xs }}>
          {rows.length === 0 ? (
            <Text variant="caption" color={colors.textOnNight}>
              {snapshot.emptyMessage}
            </Text>
          ) : (
            rows.map((a, i) => (
              <View key={a.appointmentId} style={[styles.dayRow, i > 0 && styles.dayRowDivider]}>
                <Text variant="captionStrong" color={colors.textOnNight} style={{ width: 44 }}>
                  {a.timeLabel}
                </Text>
                <View style={[styles.dot, { backgroundColor: a.status === 'PENDING_APPROVAL' ? colors.accent : proColor(a.colorKey).bar }]} />
                <Text variant="caption" color={colors.textOnNight} numberOfLines={1} style={{ flex: 1 }}>
                  {hidden ? (a.status === 'PENDING_APPROVAL' ? 'Por aprobar' : 'Cita') : `${a.serviceName} · ${a.professionalName}`}
                </Text>
              </View>
            ))
          )}
        </View>
        <Updated snapshot={snapshot} stale={stale} onNight />
      </View>
    </NightCard>
  );
}

/** 03 · Resumen semanal (grande). Cada día abre la agenda en esa fecha. */
export function WeekSummaryWidget({ snapshot, stale }: { snapshot: WidgetSnapshot; stale?: boolean }) {
  return (
    <View style={[styles.lightCard, { width: WIDGET_SIZES.mediumW, height: WIDGET_SIZES.largeH, padding: spacing.lg }]} accessibilityLabel="Vista previa: widget Resumen semanal">
      <View style={{ position: 'absolute', right: 8, top: 4 }}>
        <StaticOri pose="head" size={64} />
      </View>
      <Text variant="heading" style={{ marginRight: 64 }}>
        {snapshot.week.rangeLabel}
      </Text>
      <Text variant="caption" color={colors.textMuted}>
        {snapshot.businessName}
      </Text>
      <View style={styles.weekStrip}>
        {snapshot.week.days.map((d) => (
          <View key={d.date} style={[styles.weekDay, d.isToday && styles.weekDayToday]}>
            <Text variant="micro" color={d.isToday ? colors.textOnNight : colors.textMuted}>
              {d.weekdayShort}
            </Text>
            <Text variant="captionStrong" color={d.isToday ? colors.textOnNight : colors.text}>
              {d.dayNumber}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {snapshot.week.days.map((d, i) => (
          <View key={d.date} style={[styles.weekRow, i > 0 && styles.weekRowDivider]}>
            <Text variant={d.isToday ? 'captionStrong' : 'caption'} color={d.isToday ? colors.primary : colors.text} style={{ width: 92 }}>
              {d.weekdayShort} {d.dayNumber}
            </Text>
            <Text variant={d.closed || d.count === 0 ? 'caption' : 'captionStrong'} color={d.closed || d.count === 0 ? colors.textMuted : colors.text}>
              {d.countLabel}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.footerLine} />
      <Updated snapshot={snapshot} stale={stale} />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  lightCard: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#2A1F7A',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    overflow: 'hidden',
  },
  oriCorner: { position: 'absolute', right: 4, top: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footerLine: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
  dayRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.18)' },
  weekStrip: { flexDirection: 'row', gap: 4, marginVertical: spacing.sm },
  weekDay: { flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  weekDayToday: { backgroundColor: colors.primary },
  weekRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  weekRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
}));
