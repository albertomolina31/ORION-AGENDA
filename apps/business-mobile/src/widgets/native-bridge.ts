import type { WidgetSnapshot } from '@orion/contracts';

/**
 * Puente hacia los widgets nativos. Esta versión (web y plataformas sin widgets) no hace
 * nada; Metro elige `native-bridge.ios.ts` o `native-bridge.android.tsx` en el teléfono.
 */
export async function syncNativeWidgets(_snapshot: WidgetSnapshot): Promise<void> {}
export async function clearNativeWidgets(): Promise<void> {}
