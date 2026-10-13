import { buildWidgetViewModel, type WidgetSnapshot } from '@orion/contracts';
import { View } from 'react-native';
import { WidgetPreview } from 'react-native-android-widget';
import { AgendaDelDiaWidget, ProximaCitaWidget, ResumenSemanalWidget } from '@/widgets/android-widgets';
import { colors, getColorScheme, spacing, Text } from '@/ui';

/** En Android se dibuja el widget real (RemoteViews) con los mismos datos. */
export function NativeWidgetPreviews({ snapshot }: { snapshot: WidgetSnapshot }) {
  const vm = buildWidgetViewModel(snapshot, new Date());
  const dark = getColorScheme() === 'dark';
  return (
    <View style={{ gap: spacing.md, alignItems: 'center' }}>
      <Text variant="captionStrong" color={colors.textMuted}>
        Widget nativo de Android
      </Text>
      <WidgetPreview renderWidget={() => <ProximaCitaWidget vm={vm} dark={dark} />} width={170} height={170} />
      <WidgetPreview renderWidget={() => <AgendaDelDiaWidget vm={vm} />} width={340} height={170} />
      <WidgetPreview renderWidget={() => <ResumenSemanalWidget vm={vm} dark={dark} />} width={340} height={360} />
    </View>
  );
}
