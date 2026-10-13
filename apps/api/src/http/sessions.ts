import { randomBytes } from 'node:crypto';

/**
 * ⚠️ Sesiones SIMULADAS (decisión: login simulado mientras se define la identidad,
 * sección 14). Tokens opacos en memoria; no hay contraseñas, refresh ni expiración real.
 * No usar con datos reales.
 */
export class SimulatedSessionStore {
  private tokens = new Map<string, string>();

  issue(userId: string): string {
    const token = `sim_${randomBytes(18).toString('base64url')}`;
    this.tokens.set(token, userId);
    return token;
  }

  resolve(token: string): string | undefined {
    return this.tokens.get(token);
  }

  revoke(token: string): void {
    this.tokens.delete(token);
  }

  clear(): void {
    this.tokens.clear();
  }
}
