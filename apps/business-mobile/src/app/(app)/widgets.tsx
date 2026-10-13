import { buildWidgetSnapshot, WIDGET_PRIVACY_LABELS, WidgetPrivacy, type WidgetSnapshot } from '@orion/contracts';
import { router } from 'expo-router';
import { Eye, EyeOff, Lock } from 'lucide-react-native';
import { type ReactNode, useMemo } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { NativeWidgetPreviews } from '@/features/NativeWidgetPreviews';
import { DayAgendaWidget, NextAppointmentWidget, WeekSummaryWidget, WIDGET_SIZES } from '@/features/WidgetPreviews';
import { useProfile } from '@/lib/queries';
import { useWidgetPrivacyPreference, useWidgetSnapshot } from '@/lib/widgets';
import { Appear, colors, ErrorState, Note, RadioCard, Screen, SectionHeader, SkeletonList, spacing, StackHeader, Text } from '@/ui';

const ICONS = { FULL: Eye, INITIALS: EyeOff, HIDDEN: Lock } as const;
const DESCRIPTIONS: Record<WidgetPrivacy, string> = {
  FULL: '“Mariana López”. Solo si tu teléfono no lo ve nadie más.',
  INITIALS: '“M. L.” Recomendado: reconoces la cita sin exponer al cliente.',
  HIDDEN: 'Solo la hora y “Próxima cita”. Sin cliente, servicio ni profesional.',
};
const RANK: Record<WidgetPrivacy, number> = { FULL: 0, INITIALS: 1, HIDDEN: 2 };

/** Escala la vista previa en teléfonos angostos sin cambiar su proporción. */
function Fit({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const { width: screen } = useWindowDimensions();
  const available = Math.min(screen, 600) - spacing.lg * 2;
  const scale = Math.min(1, available / width);
  return (
    <View style={{ width: width * scale, height: height * scale, alignSelf: 'center' }}>
      <View style={{ width, height, transform: [{ scale }], transformOrigin: 'top left' }}>{children}</View>
    </View>
  );
}

function Caption({ children }: { children: string }) {
  return (
    <Text variant="caption" color={colors.textMuted} style={{ textAlign: 'center', marginTop: spacing.sm }}>
      {children}
    </Text>
  );
}

/** Widgets de inicio: vista previa con datos reales y privacidad (plan W2). */
export default function Widgets() {
  const profile = useProfile();
  const [preference, setPreference] = useWidgetPrivacyPreference();
  const { snapshot, loading } = useWidgetSnapshot();
  const hiddenExample = useWidgetSnapshot({ privacy: 'HIDDEN' }).snapshot;
  const businessMax = profile.data?.widgetPrivacy ?? 'INITIALS';

  // Estados de ejemplo con el mismo constructor: día sin citas.
  const emptyExample = useMemo<WidgetSnapshot | null>(() => {
    if (!snapshot) return null;
    return buildWidgetSnapshot({
      now: new Date(snapshot.generatedAt),
      business: { id: snapshot.businessId, name: snapshot.businessName, timezone: snapshot.timezone },
      privacy: snapshot.privacy,
      today: snapshot.today,
      week: { appointments: [], days: [] },
      schedules: null,
    });
  }, [snapshot]);

  return (
    <Screen header={<StackHeader title="Widgets" subtitle="Tu agenda, a un vistazo" />}>
      <Note
        title="Vista previa"
        body="Así se verán los widgets con tus datos actuales. Para agregarlos, instala la app (development build) y mantén presionada la pantalla de inicio → Widgets → Orion Business. En el navegador y en Expo Go no existen."
      />

      <Appear>
        <SectionHeader title="Qué se muestra de tus clientes" />
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {WidgetPrivacy.options
            .filter((v) => RANK[v] >= RANK[businessMax])
            .map((v) => (
              <RadioCard
                key={v}
                icon={ICONS[v]}
                title={WIDGET_PRIVACY_LABELS[v]}
                description={DESCRIPTIONS[v]}
                selected={(snapshot?.privacy ?? businessMax) === v}
                onPress={() => void setPreference(v)}
              />
            ))}
          <Text variant="caption" color={colors.textMuted}>
            {businessMax === 'FULL'
              ? 'Preferencia de este teléfono. '
              : `El negocio permite como máximo “${WIDGET_PRIVACY_LABELS[businessMax]}”; tú puedes ocultar más. `}
            En la pantalla bloqueada nunca se muestran nombres.
            {preference ? '' : ' Sin preferencia: se usa la del negocio.'}
          </Text>
          <Pressable onPress={() => router.push('/ajustes/reglas')} accessibilityRole="link">
            <Text variant="captionStrong" color={colors.primary}>
              Cambiar el máximo del negocio
            </Text>
          </Pressable>
        </View>
      </Appear>

      {loading ? <SkeletonList rows={3} /> : null}
      {!loading && !snapshot ? <ErrorState error={profile.error} onRetry={() => void profile.refetch()} /> : null}

      {snapshot ? (
        <>
          <Appear index={1}>
            <SectionHeader title="01 · Próxima cita" trailing={<Text variant="caption" color={colors.textMuted}>Pequeño</Text>} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.md }}>
              <NextAppointmentWidget snapshot={snapshot} />
              {hiddenExample && snapshot.privacy !== 'HIDDEN' ? <NextAppointmentWidget snapshot={hiddenExample} /> : null}
            </View>
            <Caption>Al tocarlo abre el detalle de la cita. La hora cambia sola cuando termina una cita.</Caption>
          </Appear>

          <Appear index={2}>
            <SectionHeader title="02 · Agenda del día" trailing={<Text variant="caption" color={colors.textMuted}>Mediano</Text>} />
            <View style={{ marginTop: spacing.md }}>
              <Fit width={WIDGET_SIZES.mediumW} height={WIDGET_SIZES.mediumH}>
                <DayAgendaWidget snapshot={snapshot} />
              </Fit>
            </View>
            <Caption>Abre la agenda del día.</Caption>
          </Appear>

          <Appear index={3}>
            <SectionHeader title="03 · Resumen semanal" trailing={<Text variant="caption" color={colors.textMuted}>Grande</Text>} />
            <View style={{ marginTop: spacing.md }}>
              <Fit width={WIDGET_SIZES.mediumW} height={WIDGET_SIZES.largeH}>
                <WeekSummaryWidget snapshot={snapshot} />
              </Fit>
            </View>
            <Caption>Cada día abre la agenda en esa fecha.</Caption>
          </Appear>

          <Appear index={4}>
            <SectionHeader title="Estados" trailing={<Text variant="caption" color={colors.textMuted}>Sin citas y datos sin actualizar</Text>} />
            <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
              {emptyExample ? (
                <Fit width={WIDGET_SIZES.mediumW} height={WIDGET_SIZES.mediumH}>
                  <DayAgendaWidget snapshot={emptyExample} />
                </Fit>
              ) : null}
              <View style={{ alignItems: 'center' }}>
                <NextAppointmentWidget snapshot={snapshot} stale />
              </View>
            </View>
            <Caption>Si la app no se abre en más de 2 horas, el widget lo dice en vez de mostrar datos viejos como actuales.</Caption>
          </Appear>

          <NativeWidgetPreviews snapshot={snapshot} />

          <Note
            title="¿Y las animaciones?"
            body="iOS y Android dibujan los widgets como imágenes: Ori aparece con la pose del momento (saluda, celebra, duerme) pero no se mueve. En iPhone, los cambios de hora y de lista se animan al actualizarse."
          />
        </>
      ) : null}
    </Screen>
  );
}
