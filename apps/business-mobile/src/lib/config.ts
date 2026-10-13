import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Las variables EXPO_PUBLIC_* quedan en el bundle: nunca poner secretos aquí.
 * Sin configuración, en desarrollo se usa el host del servidor de Metro.
 */
function defaultApiUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri && Platform.OS !== 'web') return `http://${hostUri.split(':')[0]}:3000`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl()).replace(/\/$/, '');
