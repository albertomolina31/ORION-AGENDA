import type { WidgetViewModel } from '@orion/contracts';
import { FlexWidget, ImageWidget, TextWidget, type ColorProp } from 'react-native-android-widget';

/**
 * Widgets de Android con `react-native-android-widget` (se dibujan como RemoteViews).
 * Mismo diseño que iOS y mismo modelo de vista; sin animaciones (Android no las permite en
 * widgets). Cada zona tocable abre un deep link con la sesión revalidada en la app.
 */
export const ANDROID_WIDGET_NAMES = ['ProximaCita', 'AgendaDelDia', 'ResumenSemanal'] as const;
export type AndroidWidgetName = (typeof ANDROID_WIDGET_NAMES)[number];

const ORI = {
  head: require('../../assets/ori/ori-head.png'),
  wave: require('../../assets/ori/ori-wave.png'),
  calendar: require('../../assets/ori/ori-calendar.png'),
  celebrate: require('../../assets/ori/ori-celebrate.png'),
  sleep: require('../../assets/ori/ori-sleep.png'),
} as const;

interface Palette {
  bg: ColorProp;
  ink: ColorProp;
  muted: ColorProp;
  violet: ColorProp;
  chip: ColorProp;
  border: ColorProp;
  danger: ColorProp;
}
const LIGHT: Palette = { bg: '#FFFFFF', ink: '#11163D', muted: '#555A78', violet: '#5B3DF5', chip: '#F7F4FC', border: '#E7E3EE', danger: '#C6283C' };
const DARK: Palette = { bg: '#171A42', ink: '#F3F1FF', muted: '#B4B2D8', violet: '#8E78FF', chip: '#1D2050', border: '#2C3066', danger: '#FF6B7D' };

const open = (uri: string) => ({ clickAction: 'OPEN_URI' as const, clickActionData: { uri } });

function Updated({ vm, c }: { vm: WidgetViewModel; c: Palette }) {
  return <TextWidget text={vm.updatedLabel} maxLines={1} style={{ fontSize: 11, color: vm.stale ? c.danger : c.muted }} />;
}

export function ProximaCitaWidget({ vm, dark }: { vm: WidgetViewModel; dark: boolean }) {
  const c = dark ? DARK : LIGHT;
  const n = vm.next;
  return (
    <FlexWidget
      {...open(n ? n.deepLink : 'orionbusiness://agenda')}
      accessibilityLabel={n ? `Próxima cita ${n.timeLabel}` : 'Sin próximas citas'}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.bg, borderRadius: 22, padding: 12, flexDirection: 'column', justifyContent: 'space-between' }}
    >
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <TextWidget text={vm.businessName} maxLines={1} truncate="END" style={{ fontSize: 12, color: c.muted }} />
        <ImageWidget image={ORI.head} imageWidth={30} imageHeight={30} />
      </FlexWidget>
      {n ? (
        <FlexWidget style={{ flexDirection: 'column' }}>
          {n.dayLabel ? <TextWidget text={n.dayLabel} style={{ fontSize: 12, fontWeight: '700', color: c.violet }} /> : null}
          <TextWidget text={n.timeLabel} style={{ fontSize: 32, fontWeight: '800', color: c.ink }} />
          <TextWidget text={n.title} maxLines={1} truncate="END" style={{ fontSize: 14, fontWeight: '600', color: c.ink }} />
          <TextWidget
            text={vm.hidden ? '🔒 Información oculta' : `● ${n.statusLabel}`}
            style={{ fontSize: 11, fontWeight: '600', color: vm.hidden ? c.muted : n.pending ? '#B26A00' : '#1E8E4E' }}
          />
          {n.detail ? <TextWidget text={n.detail} maxLines={1} truncate="END" style={{ fontSize: 11, color: c.muted }} /> : null}
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flexDirection: 'column' }}>
          <TextWidget text="Sin próximas citas" style={{ fontSize: 15, fontWeight: '700', color: c.ink }} />
          <TextWidget text="Esta semana no hay más citas." style={{ fontSize: 12, color: c.muted }} />
        </FlexWidget>
      )}
      <Updated vm={vm} c={c} />
    </FlexWidget>
  );
}

export function AgendaDelDiaWidget({ vm }: { vm: WidgetViewModel }) {
  return (
    <FlexWidget
      {...open(vm.today.deepLink)}
      accessibilityLabel={vm.today.title}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        borderRadius: 22,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundGradient: { from: '#12143F', to: '#4B3BC4', orientation: 'TL_BR' },
      }}
    >
      <FlexWidget style={{ flex: 1, height: 'match_parent', flexDirection: 'column', justifyContent: 'space-between' }}>
        <TextWidget text={vm.today.title} maxLines={1} truncate="END" style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }} />
        {vm.today.rows.length === 0 ? (
          <TextWidget text={vm.today.emptyMessage} style={{ fontSize: 13, color: '#FFFFFF' }} />
        ) : (
          <FlexWidget style={{ flexDirection: 'column', flexGap: 4 }}>
            {vm.today.rows.map((r) => (
              <FlexWidget key={r.id} {...open(r.deepLink)} style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
                <TextWidget text={r.timeLabel} style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }} />
                <TextWidget text="●" style={{ fontSize: 10, color: r.color as ColorProp }} />
                <TextWidget text={r.text} maxLines={1} truncate="END" style={{ fontSize: 13, color: '#FFFFFF' }} />
              </FlexWidget>
            ))}
          </FlexWidget>
        )}
        <TextWidget text={vm.updatedLabel} style={{ fontSize: 11, color: vm.stale ? '#FFB4BE' : '#C9C6F2' }} />
      </FlexWidget>
      <ImageWidget image={ORI[vm.oriPose]} imageWidth={84} imageHeight={84} />
    </FlexWidget>
  );
}

export function ResumenSemanalWidget({ vm, dark }: { vm: WidgetViewModel; dark: boolean }) {
  const c = dark ? DARK : LIGHT;
  return (
    <FlexWidget
      {...open('orionbusiness://agenda')}
      accessibilityLabel={`Resumen semanal ${vm.week.rangeLabel}`}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.bg, borderRadius: 22, padding: 14, flexDirection: 'column', flexGap: 6 }}
    >
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between' }}>
        <FlexWidget style={{ flexDirection: 'column' }}>
          <TextWidget text={vm.week.rangeLabel} style={{ fontSize: 19, fontWeight: '800', color: c.ink }} />
          <TextWidget text={vm.businessName} style={{ fontSize: 13, color: c.muted }} />
        </FlexWidget>
        <ImageWidget image={ORI.head} imageWidth={42} imageHeight={42} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', flexGap: 4 }}>
        {vm.week.days.map((d) => (
          <FlexWidget
            key={d.date}
            {...open(d.deepLink)}
            style={{ flex: 1, flexDirection: 'column', alignItems: 'center', paddingVertical: 4, borderRadius: 10, backgroundColor: d.isToday ? c.violet : c.chip }}
          >
            <TextWidget text={d.weekdayShort} style={{ fontSize: 10, fontWeight: '600', color: d.isToday ? '#FFFFFF' : c.muted }} />
            <TextWidget text={String(d.dayNumber)} style={{ fontSize: 14, fontWeight: '700', color: d.isToday ? '#FFFFFF' : c.ink }} />
          </FlexWidget>
        ))}
      </FlexWidget>
      <FlexWidget style={{ flex: 1, flexDirection: 'column', width: 'match_parent', justifyContent: 'space-between' }}>
        {vm.week.days.map((d) => {
          const quiet = d.closed || d.countLabel === 'Sin citas';
          return (
            <FlexWidget key={`row-${d.date}`} {...open(d.deepLink)} style={{ flexDirection: 'row', width: 'match_parent', borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: 2 }}>
              <TextWidget text={d.label} style={{ fontSize: 13, fontWeight: d.isToday ? '700' : '400', color: d.isToday ? c.violet : c.ink, width: 80 }} />
              <TextWidget text={d.countLabel} style={{ fontSize: 13, fontWeight: quiet ? '400' : '700', color: quiet ? c.muted : c.ink }} />
            </FlexWidget>
          );
        })}
      </FlexWidget>
      <Updated vm={vm} c={c} />
    </FlexWidget>
  );
}

/** Dibuja el widget pedido; `light`/`dark` deja que Android elija según el tema del sistema. */
export function renderAndroidWidget(name: string, vm: WidgetViewModel) {
  switch (name as AndroidWidgetName) {
    case 'ProximaCita':
      return { light: <ProximaCitaWidget vm={vm} dark={false} />, dark: <ProximaCitaWidget vm={vm} dark /> };
    case 'AgendaDelDia':
      return <AgendaDelDiaWidget vm={vm} />;
    case 'ResumenSemanal':
      return { light: <ResumenSemanalWidget vm={vm} dark={false} />, dark: <ResumenSemanalWidget vm={vm} dark /> };
    default:
      return <ProximaCitaWidget vm={vm} dark={false} />;
  }
}
