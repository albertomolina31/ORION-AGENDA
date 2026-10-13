import type { WidgetSnapshot } from '@orion/contracts';

/** Vista previa con el widget nativo real: solo existe en Android (ver .android.tsx). */
export function NativeWidgetPreviews(_: { snapshot: WidgetSnapshot }) {
  return null;
}
