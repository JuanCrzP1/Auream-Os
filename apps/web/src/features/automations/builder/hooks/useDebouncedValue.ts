import { useEffect, useState } from "react";

/**
 * Devuelve `value` retrasado: solo se propaga cuando pasan `delayMs` sin que
 * vuelva a cambiar.
 *
 * Responsabilidad única: temporización. No sabe qué es el valor ni qué se hará
 * con él. Quien decide si hay que guardar, y cuándo se considera guardado, es
 * `useDraftSync`.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebounced(value), delayMs);

    // Cada cambio cancela el temporizador anterior: esto es lo que hace que el
    // debounce sea real. El cleanup NO propaga el valor, a diferencia de la
    // implementación anterior, donde el propio cleanup emitía y convertía el
    // debounce en un guardado por pulsación.
    return () => window.clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debounced;
}
