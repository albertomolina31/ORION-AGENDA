import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Credenciales de sesión en almacenamiento seguro del dispositivo (SecureStore).
 * En web (solo para revisar UI) se usa sessionStorage; puede no estar disponible.
 */
export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return globalThis.sessionStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        globalThis.sessionStorage?.setItem(key, value);
      } catch {
        /* sin almacenamiento: la sesión vive solo en memoria */
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        globalThis.sessionStorage?.removeItem(key);
      } catch {
        /* nada que limpiar */
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
