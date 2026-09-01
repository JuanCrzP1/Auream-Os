import { useEffect, useRef, useState } from "react";

/** Estados por los que pasa la sincronización de un borrador. */
export type DraftSyncStatus = "idle" | "saving" | "saved" | "error";

interface UseDraftSyncParams<T> {
  /** Borrador vivo. Solo se usa para el volcado al desmontar. */
  readonly draft: T | null;
  /** Borrador ya retrasado. Es lo que dispara un guardado. */
  readonly debouncedDraft: T | null;
  /** Firma de lo que el servidor ya tiene al cargar. */
  readonly seedSignature: string | null;
  readonly enabled: boolean;
  /** Transporte. Debe rechazar si el guardado falla. */
  readonly save: (draft: T) => Promise<void>;
}

/** Identidad de un borrador para decidir si hay algo nuevo que guardar. */
function signatureOf(draft: unknown): string {
  return JSON.stringify(draft);
}

/**
 * Sincroniza un borrador con su almacén y expone el estado REAL de esa
 * sincronización.
 *
 * Responsabilidad única: la política de sincronización. La temporización es de
 * `useDebouncedValue`; el transporte, del servicio que se pasa en `save`; la
 * persistencia, del puerto que hay detrás.
 *
 * Garantías, todas comprobadas en `tests/hooks/useDraftSync.test.tsx`:
 *
 *  - Un borrador se marca guardado SOLO cuando su petición resuelve bien. Si
 *    falla, la firma no avanza y el estado pasa a `error`: el indicador de la
 *    topbar no puede decir «Guardado» sobre algo que no se guardó.
 *  - Nunca hay dos peticiones a la vez. Si llega un cambio mientras una está en
 *    vuelo, se guarda como pendiente —solo el último— y sale al terminar.
 *    Esto es lo que hace que el bloqueo optimista de la Fase C tenga sentido:
 *    las versiones llegan en orden.
 *  - Un borrador idéntico al último guardado no genera petición.
 *  - Al desmontar, un cambio pendiente se envía igualmente: cerrar la pestaña
 *    no debe perder trabajo.
 */
export function useDraftSync<T>({
  draft,
  debouncedDraft,
  seedSignature,
  enabled,
  save
}: UseDraftSyncParams<T>): DraftSyncStatus {
  const [status, setStatus] = useState<DraftSyncStatus>("idle");

  // Firma de lo último confirmado por el servidor. Avanza SOLO tras éxito.
  const savedSignatureRef = useRef<string | null>(seedSignature);
  const inFlightRef = useRef(false);
  const pendingRef = useRef<{ draft: T; signature: string } | null>(null);
  const mountedRef = useRef(true);

  // El borrador vivo y el transporte se leen por referencia para que el volcado
  // de desmontaje no trabaje sobre una clausura obsoleta.
  const liveDraftRef = useRef<T | null>(draft);
  liveDraftRef.current = draft;
  const saveRef = useRef(save);
  saveRef.current = save;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    savedSignatureRef.current = seedSignature;
  }, [seedSignature]);

  // Declarada en el cuerpo del hook y no memoizada: solo cierra sobre refs y
  // sobre `setStatus`, que son estables, así que recrearla no tiene efecto.
  async function run(draftToSave: T, signature: string): Promise<void> {
    inFlightRef.current = true;
    if (mountedRef.current) setStatus("saving");

    try {
      await saveRef.current(draftToSave);
      savedSignatureRef.current = signature;
      if (mountedRef.current) setStatus("saved");
    } catch {
      // La firma NO avanza: el cambio sigue considerándose no guardado y el
      // siguiente intento volverá a enviarlo.
      if (mountedRef.current) setStatus("error");
    } finally {
      inFlightRef.current = false;

      const next = pendingRef.current;
      pendingRef.current = null;
      if (next && next.signature !== savedSignatureRef.current) {
        void run(next.draft, next.signature);
      }
    }
  }

  useEffect(() => {
    if (!enabled || debouncedDraft === null) return;

    const signature = signatureOf(debouncedDraft);
    if (signature === savedSignatureRef.current) return;

    if (inFlightRef.current) {
      // Cola de uno: solo interesa el último estado del borrador.
      pendingRef.current = { draft: debouncedDraft, signature };
      return;
    }

    void run(debouncedDraft, signature);
  }, [debouncedDraft, enabled]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      const live = liveDraftRef.current;
      if (!enabledRef.current || live === null) return;

      const signature = signatureOf(live);
      if (signature === savedSignatureRef.current) return;
      if (pendingRef.current?.signature === signature) return;

      // Sin `await` posible en un cleanup. No se marca nada como guardado: el
      // componente ya no existe y nadie puede leer ese estado. Lo único que
      // importa aquí es no perder el cambio.
      void saveRef.current(live).catch(() => undefined);
    };
  }, []);

  return status;
}
