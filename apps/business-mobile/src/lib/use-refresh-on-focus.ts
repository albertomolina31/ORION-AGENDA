import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/** Refrescar al volver a la pantalla (sección 13). Omite el primer enfoque (ya se cargó). */
export function useRefreshOnFocus(refetch: () => unknown) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );
}
