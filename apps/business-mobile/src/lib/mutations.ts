import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { ApiError } from './api-client';
import { endpoints } from './endpoints';
import { newRequestId } from './request-id';

/**
 * Mutación idempotente: la clave se crea una vez por intención y se reutiliza si la
 * persona reintenta. Si el resultado es incierto (timeout/red), se consulta
 * /operations/:requestId antes de permitir otra solicitud (sección 10).
 */
export function useIdempotentMutation<TInput, TOutput>(fn: (input: TInput, requestId: string) => Promise<TOutput>, invalidate: unknown[][] = []) {
  const qc = useQueryClient();
  const key = useRef<string | null>(null);
  const mutation = useMutation<TOutput, ApiError, TInput>({
    mutationFn: async (input) => {
      key.current ??= newRequestId();
      const requestId = key.current;
      try {
        return await fn(input, requestId);
      } catch (err) {
        if (err instanceof ApiError && err.uncertain) {
          // Consultar si la operación llegó a ejecutarse.
          const op = await endpoints.operation(requestId).catch(() => null);
          if (op?.status === 'SUCCEEDED') return op.body as TOutput;
          if (op?.status === 'FAILED') {
            const b = op.body as { code: ApiError['code']; message: string } | null;
            throw new ApiError(b?.code ?? 'INTERNAL_ERROR', b?.message ?? 'La operación falló.', op.httpStatus);
          }
        }
        throw err;
      }
    },
    onSuccess: () => {
      key.current = null;
      invalidate.forEach((k) => void qc.invalidateQueries({ queryKey: k }));
    },
    onError: (err) => {
      // Un error de negocio definitivo libera la clave; un resultado incierto la conserva.
      if (!err.uncertain) key.current = null;
    },
  });
  return { ...mutation, resetKey: () => (key.current = null) };
}
