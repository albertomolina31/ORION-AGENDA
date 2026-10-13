import * as Crypto from 'expo-crypto';

/** Clave de operación: se genera antes de enviar y se reutiliza en reintentos. */
export function newRequestId(): string {
  return Crypto.randomUUID();
}
