import { buildWidgetViewModel, type WidgetSnapshot } from '@orion/contracts';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { ANDROID_WIDGET_NAMES, renderAndroidWidget } from './android-widgets';
import { SIGNED_OUT_VIEW_MODEL } from './signed-out';

/** Android: redibuja los widgets colocados con la instantánea nueva (o el estado sin sesión). */
export async function syncNativeWidgets(snapshot: WidgetSnapshot): Promise<void> {
  const vm = buildWidgetViewModel(snapshot, new Date());
  await Promise.all(ANDROID_WIDGET_NAMES.map((widgetName) => requestWidgetUpdate({ widgetName, renderWidget: () => renderAndroidWidget(widgetName, vm) }).catch(() => undefined)));
}

export async function clearNativeWidgets(): Promise<void> {
  await Promise.all(
    ANDROID_WIDGET_NAMES.map((widgetName) => requestWidgetUpdate({ widgetName, renderWidget: () => renderAndroidWidget(widgetName, SIGNED_OUT_VIEW_MODEL) }).catch(() => undefined)),
  );
}
