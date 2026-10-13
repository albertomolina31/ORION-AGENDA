import type { WidgetViewModel } from '@orion/contracts';
import { HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  containerBackground,
  contentTransition,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  padding,
  resizable,
  shapes,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';

/**
 * Widgets de iPhone (WidgetKit) con `expo-widgets`: JSX con componentes de Expo UI que se
 * convierten en SwiftUI. Cada función lleva la directiva 'widget': se serializa y se ejecuta
 * dentro de la extensión, así que NO puede usar nada definido fuera de su propio cuerpo
 * (ni constantes ni helpers): colores y textos van dentro. Los datos llegan ya calculados
 * (`WidgetViewModel`), por eso aquí no hay reglas de negocio.
 *
 * Sin animaciones continuas (WidgetKit no lo permite): la hora cambia con transición
 * numérica y la cuenta regresiva usa el temporizador del sistema.
 */
export type IosWidgetProps = WidgetViewModel & {
  /** Ruta local de la imagen de Ori en el directorio compartido con el widget. */
  oriImage: string | null;
};

export function ProximaCitaLayout(p: IosWidgetProps, env: WidgetEnvironment) {
  'widget';
  const dark = env.colorScheme === 'dark';
  const ink = dark ? '#F3F1FF' : '#11163D';
  const muted = dark ? '#B4B2D8' : '#555A78';
  const violet = dark ? '#8E78FF' : '#5B3DF5';
  const bg = dark ? '#171A42' : '#FFFFFF';
  const n = p.next;
  const minutesToStart = n ? (new Date(n.startsAt).getTime() - env.date.getTime()) / 60000 : 0;
  return (
    <VStack
      alignment="leading"
      spacing={2}
      modifiers={[containerBackground(bg, 'widget'), widgetURL(n ? n.deepLink : 'orionbusiness://agenda'), frame({ maxWidth: 4000, maxHeight: 4000, alignment: 'topLeading' })]}
    >
      <HStack alignment="top">
        <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(muted), lineLimit(1)]}>{p.businessName}</Text>
        <Spacer />
        {p.oriImage ? <Image uiImage={p.oriImage} modifiers={[resizable(), frame({ width: 30, height: 30 })]} /> : null}
      </HStack>
      {!n ? (
        <VStack alignment="leading" spacing={2}>
          <Spacer />
          <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle(ink)]}>Sin próximas citas</Text>
          <Text modifiers={[font({ size: 12 }), foregroundStyle(muted)]}>Esta semana no hay más citas.</Text>
        </VStack>
      ) : (
        <VStack alignment="leading" spacing={1}>
          {n.dayLabel ? <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(violet)]}>{n.dayLabel}</Text> : null}
          <Text modifiers={[font({ size: 34, weight: 'heavy', design: 'rounded' }), foregroundStyle(ink), contentTransition('numericText'), minimumScaleFactor(0.7), lineLimit(1)]}>
            {n.timeLabel}
          </Text>
          <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(ink), lineLimit(1)]}>{n.title}</Text>
          {p.hidden ? (
            <HStack spacing={4} modifiers={[padding({ horizontal: 8, vertical: 2 }), background(dark ? '#262A50' : '#EFEEF2', shapes.capsule())]}>
              <Image systemName="lock.fill" size={10} color={muted} />
              <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(muted)]}>Información oculta</Text>
            </HStack>
          ) : (
            <HStack spacing={4} modifiers={[padding({ horizontal: 8, vertical: 2 }), background(n.pending ? (dark ? '#3A2E1A' : '#FDF3E2') : dark ? '#143A2A' : '#DDF5E6', shapes.capsule())]}>
              <Image systemName="circle.fill" size={7} color={n.pending ? '#E9A23B' : '#1E8E4E'} />
              <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(n.pending ? (dark ? '#F6C877' : '#8A5300') : dark ? '#7FE0A6' : '#17683A')]}>{n.statusLabel}</Text>
            </HStack>
          )}
          {minutesToStart > 0 && minutesToStart <= 60 ? (
            <HStack spacing={3}>
              <Text modifiers={[font({ size: 11 }), foregroundStyle(muted)]}>Empieza en</Text>
              <Text date={new Date(n.startsAt)} dateStyle="timer" modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(violet)]} />
            </HStack>
          ) : n.detail ? (
            <Text modifiers={[font({ size: 11 }), foregroundStyle(muted), lineLimit(1)]}>{n.detail}</Text>
          ) : null}
        </VStack>
      )}
      <Spacer />
      <Text modifiers={[font({ size: 10, weight: 'medium' }), foregroundStyle(p.stale ? '#C6283C' : muted), lineLimit(1)]}>{p.updatedLabel}</Text>
    </VStack>
  );
}

export function AgendaDelDiaLayout(p: IosWidgetProps, env: WidgetEnvironment) {
  'widget';
  const night = { type: 'linearGradient' as const, colors: ['#12143F', '#1C1E57', '#4B3BC4'], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } };
  const muted = '#C9C6F2';
  return (
    <HStack alignment="center" spacing={8} modifiers={[containerBackground(night, 'widget'), widgetURL(p.today.deepLink)]}>
      <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: 4000, maxHeight: 4000, alignment: 'topLeading' })]}>
        <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle('#FFFFFF'), lineLimit(1)]}>{p.today.title}</Text>
        {p.today.rows.length === 0 ? (
          <VStack alignment="leading">
            <Spacer />
            <Text modifiers={[font({ size: 13 }), foregroundStyle('#FFFFFF')]}>{p.today.emptyMessage}</Text>
            <Spacer />
          </VStack>
        ) : (
          <VStack alignment="leading" spacing={6}>
            {p.today.rows.map((r) => (
              <HStack key={r.id} spacing={8}>
                <Text modifiers={[font({ size: 13, weight: 'semibold', design: 'rounded' }), foregroundStyle('#FFFFFF'), contentTransition('numericText'), frame({ width: 42, alignment: 'leading' })]}>
                  {r.timeLabel}
                </Text>
                <Image systemName="circle.fill" size={8} color={r.color} />
                <Text modifiers={[font({ size: 13 }), foregroundStyle('#FFFFFF'), lineLimit(1)]}>{r.text}</Text>
              </HStack>
            ))}
          </VStack>
        )}
        <Spacer />
        <Text modifiers={[font({ size: 10, weight: 'medium' }), foregroundStyle(p.stale ? '#FFB4BE' : muted)]}>{p.updatedLabel}</Text>
      </VStack>
      {p.oriImage ? <Image uiImage={p.oriImage} modifiers={[resizable(), frame({ width: env.widgetFamily === 'systemMedium' ? 96 : 72, height: env.widgetFamily === 'systemMedium' ? 96 : 72 })]} /> : null}
    </HStack>
  );
}

export function ResumenSemanalLayout(p: IosWidgetProps, env: WidgetEnvironment) {
  'widget';
  const dark = env.colorScheme === 'dark';
  const ink = dark ? '#F3F1FF' : '#11163D';
  const muted = dark ? '#B4B2D8' : '#555A78';
  const violet = dark ? '#8E78FF' : '#5B3DF5';
  const chip = dark ? '#1D2050' : '#F7F4FC';
  const bg = dark ? '#171A42' : '#FFFFFF';
  return (
    <VStack alignment="leading" spacing={6} modifiers={[containerBackground(bg, 'widget'), widgetURL('orionbusiness://agenda')]}>
      <HStack alignment="top">
        <VStack alignment="leading" spacing={1}>
          <Text modifiers={[font({ size: 20, weight: 'heavy' }), foregroundStyle(ink)]}>{p.week.rangeLabel}</Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle(muted)]}>{p.businessName}</Text>
        </VStack>
        <Spacer />
        {p.oriImage ? <Image uiImage={p.oriImage} modifiers={[resizable(), frame({ width: 44, height: 44 })]} /> : null}
      </HStack>
      <HStack spacing={4}>
        {p.week.days.map((d) => (
          <Link key={d.date} destination={d.deepLink}>
            <VStack spacing={1} modifiers={[frame({ maxWidth: 4000 }), padding({ vertical: 4 }), background(d.isToday ? violet : chip, shapes.roundedRectangle({ cornerRadius: 10 }))]}>
              <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle(d.isToday ? '#FFFFFF' : muted)]}>{d.weekdayShort}</Text>
              <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(d.isToday ? '#FFFFFF' : ink)]}>{String(d.dayNumber)}</Text>
            </VStack>
          </Link>
        ))}
      </HStack>
      <VStack alignment="leading" spacing={5}>
        {p.week.days.map((d) => (
          <Link key={`row-${d.date}`} destination={d.deepLink}>
            <HStack>
              <Text modifiers={[font({ size: 13, weight: d.isToday ? 'bold' : 'regular' }), foregroundStyle(d.isToday ? violet : ink), frame({ width: 72, alignment: 'leading' })]}>{d.label}</Text>
              <Text modifiers={[font({ size: 13, weight: d.closed || d.countLabel === 'Sin citas' ? 'regular' : 'bold' }), foregroundStyle(d.closed || d.countLabel === 'Sin citas' ? muted : ink), contentTransition('numericText')]}>
                {d.countLabel}
              </Text>
              <Spacer />
            </HStack>
          </Link>
        ))}
      </VStack>
      <Spacer />
      <Text modifiers={[font({ size: 10, weight: 'medium' }), foregroundStyle(p.stale ? '#C6283C' : muted)]}>{p.updatedLabel}</Text>
    </VStack>
  );
}
