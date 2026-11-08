import { useEffect, useSyncExternalStore } from "react";
import { sessionObjectUrl, subscribeToSession } from "./mediaSourceSession";
import { cachedThumbnail, prefetchThumbnail, subscribeToThumbnails } from "./mediaThumbnails";

// ---------------------------------------------------------------------------
// Puente único entre los almacenes externos (archivos de sesión, miniaturas)
// y React, con `useSyncExternalStore`: un `useState` + efecto dejaba un hueco
// entre el montaje y la suscripción (el nodo se quedaba con el icono).
// ---------------------------------------------------------------------------

/** Enlace del archivo de sesión de un bloque, reactivo en todo el árbol. */
export function useSessionObjectUrl(itemId: string): string | null {
  return useSyncExternalStore(
    subscribeToSession,
    () => sessionObjectUrl(itemId),
    // En el servidor no hay archivos de sesión.
    () => null
  );
}

/**
 * Imagen con la que representar una fuente, o `null` mientras no la haya.
 * Una imagen se devuelve al instante; de un video se pide un fotograma.
 */
export function usePreview(source: string | null, isVideo: boolean): string | null {
  // El trabajo se pide en un efecto, nunca en la lectura (sería un efecto en el render).
  useEffect(() => {
    if (isVideo && source) prefetchThumbnail(source);
  }, [isVideo, source]);

  return useSyncExternalStore(
    subscribeToThumbnails,
    () => (source ? cachedThumbnail(source, isVideo) : null),
    () => null
  );
}
