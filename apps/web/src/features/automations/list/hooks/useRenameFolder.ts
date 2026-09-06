import { useState, useCallback } from "react";
import type { AutomationFolderSummary } from "@contracts/AutomationContracts";
import { renameFolder } from "../services/renameFolder";

interface UseRenameFolderParams {
  /** Se invoca tras renombrar: el hub recarga la lista del servidor. */
  onFolderRenamed: () => void;
}

/**
 * useRenameFolder — orquesta el renombrado de una carpeta.
 *
 * Responsabilidad única: qué carpeta se está renombrando y la llamada al
 * servicio. Ni JSX, ni menú, ni conocimiento del hub.
 *
 * NO GUARDA EL NOMBRE. La lista del servidor sigue siendo la única fuente de
 * verdad: al terminar solo avisa para que el hub recargue, igual que crear
 * carpeta, mover un flujo o renombrarlo. Sin esto habría dos versiones de cómo
 * se llama cada carpeta.
 */
export function useRenameFolder({ onFolderRenamed }: UseRenameFolderParams) {
  const [target, setTarget] = useState<AutomationFolderSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const request = useCallback((folder: AutomationFolderSummary) => setTarget(folder), []);
  const cancel = useCallback(() => setTarget(null), []);

  const confirm = useCallback(
    async (name: string) => {
      if (!target || busy) return;

      setBusy(true);
      try {
        await renameFolder(target.id, name);
        onFolderRenamed();
      } finally {
        // Se cierra pase lo que pase: dejar el diálogo abierto sobre un nombre
        // que quizá se guardó y quizá no sería peor que cerrarlo.
        setBusy(false);
        setTarget(null);
      }
    },
    [target, busy, onFolderRenamed]
  );

  return { target, busy, request, cancel, confirm };
}
