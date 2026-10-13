import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildWidgetViewModel, WidgetSnapshot } from '@orion/contracts';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { renderAndroidWidget } from './android-widgets';
import { SIGNED_OUT_VIEW_MODEL } from './signed-out';

/**
 * Android llama a esta tarea en segundo plano cuando el widget se agrega, cambia de tamaño
 * o le toca actualizarse (updatePeriodMillis). Lee la última instantánea que dejó la app;
 * nunca llama a la API ni usa credenciales (fase 1 del plan).
 */
registerWidgetTaskHandler(async ({ widgetInfo, widgetAction, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  let vm = SIGNED_OUT_VIEW_MODEL;
  try {
    const raw = await AsyncStorage.getItem('orion.widget.snapshot');
    const parsed = raw ? WidgetSnapshot.safeParse(JSON.parse(raw)) : null;
    if (parsed?.success) vm = buildWidgetViewModel(parsed.data, new Date());
  } catch {
    /* Instantánea ilegible: se muestra el estado sin datos. */
  }
  renderWidget(renderAndroidWidget(widgetInfo.widgetName, vm));
});
