import type { ErrorCode, ErrorEnvelope } from '@orion/contracts';
import { API_URL } from './config';
import { reportServerReachable } from './network';

/** OFFLINE = no se envió nada (sin conexión); NETWORK/TIMEOUT = se envió y el resultado es incierto. */
export type ClientErrorCode = ErrorCode | 'NETWORK' | 'TIMEOUT' | 'OFFLINE';

export class ApiError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    message: string,
    readonly status: number | null,
    readonly fieldErrors?: Record<string, string[]>,
    readonly details?: Record<string, unknown>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Timeout o red caída tras enviar: el resultado es incierto, no un fallo (sección 10). */
  get uncertain(): boolean {
    return this.code === 'TIMEOUT' || this.code === 'NETWORK';
  }
}

type TokenGetter = () => string | null;
type UnauthorizedHandler = () => void;

let getToken: TokenGetter = () => null;
let onUnauthorized: UnauthorizedHandler = () => {};

export function configureApiClient(opts: { getToken: TokenGetter; onUnauthorized: UnauthorizedHandler }) {
  getToken = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

const TIMEOUT_MS = 15_000;

export async function api<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  opts: { query?: Record<string, string | number | undefined | null>; body?: unknown } = {},
): Promise<T> {
  const url = new URL(`${API_URL}/v1${path}`);
  Object.entries(opts.query ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = (err as Error).name === 'AbortError';
    reportServerReachable(false);
    throw new ApiError(
      aborted ? 'TIMEOUT' : 'NETWORK',
      aborted ? 'La respuesta tardó demasiado.' : 'No hay conexión con el servidor.',
      null,
    );
  } finally {
    clearTimeout(timer);
  }
  reportServerReachable(true);
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const env = json as Partial<ErrorEnvelope> | null;
    const error = new ApiError(
      (env?.code as ErrorCode) ?? 'INTERNAL_ERROR',
      env?.message ?? 'Ocurrió un error inesperado.',
      res.status,
      env?.fieldErrors,
      env?.details as Record<string, unknown> | undefined,
      env?.requestId,
    );
    if (res.status === 401) onUnauthorized();
    throw error;
  }
  return json as T;
}
