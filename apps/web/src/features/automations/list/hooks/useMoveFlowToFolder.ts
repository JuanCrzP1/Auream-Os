import { useState, useCallback, useRef } from "react";
import { moveAutomationToFolder } from "../services/moveAutomationToFolder";

interface UseMoveFlowToFolderParams {
  /** Se invoca tras mover: el hub recarga la lista del servidor. */
  onFlowMoved: () => void;
}

/**
 * useMoveFlowToFolder — orquesta el movimiento de un flujo a una carpeta.
 *
 * Responsabilidad única: llamar al servicio y contar cómo fue. No conoce el
 * arrastre —eso es de las tarjetas—, ni el JSX, ni la forma de la lista.
 *
 * NO GUARDA EL RESULTADO. La lista del servidor sigue siendo la única fuente
 * de verdad: al terminar solo avisa para que el hub recargue, igual que hacen
 * crear carpeta, renombrar y borrar. Sin esto habría dos versiones de dónde
 * está cada flujo, y la del cliente ganaría hasta la siguiente recarga.
 *
 * SI FALLA, NO SE FINGE QUE FUE BIEN: no se avisa de un movimiento que no
 * ocurrió, así que la lista se queda como estaba —que es como está de verdad—
 * y el error queda a la vista.
 */
export function useMoveFlowToFolder({ onFlowMoved }: UseMoveFlowToFolderParams) {
  const [error, setError] = useState<string | null>(null);
  // Un arrastre puede soltarse dos veces seguidas sin querer. Se ignora lo que
  // llegue mientras hay un movimiento en vuelo: la lista aún no refleja el
  // primero, así que el segundo se decidiría sobre datos viejos.
  const enCurso = useRef(false);

  const moveToFolder = useCallback(
    async (flowId: string, folderId: string | null) => {
      if (enCurso.current) return;

      enCurso.current = true;
      setError(null);

      try {
        await moveAutomationToFolder(flowId, folderId);
        onFlowMoved();
      } catch {
        setError("No se pudo mover la automatización. Inténtalo de nuevo.");
      } finally {
        enCurso.current = false;
      }
    },
    [onFlowMoved]
  );

  return { error, moveToFolder };
}
