import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createAutomation } from "../services/createAutomation";
import { duplicateAutomation } from "../services/duplicateAutomation";
import { setAutomationArchived } from "../services/setAutomationArchived";
import type { AutomationSummary } from "@contracts/AutomationContracts";

interface UseAutomationLifecycleParams {
  /** Tras duplicar, archivar o restaurar: el hub recarga la lista del servidor. */
  readonly onChanged: () => void;
}

/**
 * useAutomationLifecycle — crear, duplicar, archivar y restaurar.
 *
 * Mismo patrón que el resto de acciones del hub: llama al servicio, avisa para
 * recargar y no guarda copia propia de la lista (la verdad es el servidor).
 * Si algo falla lo dice; no finge que fue bien. Ignora una segunda acción
 * mientras hay otra en vuelo (doble clic).
 */
export function useAutomationLifecycle({ onChanged }: UseAutomationLifecycleParams) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const run = useCallback(async (action: () => Promise<void>, failure: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError(failure);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);

  /** Crea (dentro de la carpeta abierta, si hay una) y abre el builder. */
  const create = useCallback(
    (folderId: string | null) =>
      run(async () => {
        const created = await createAutomation(folderId ? { folderId } : {});
        navigate(`/builder/${created.key}`);
      }, "No se pudo crear la automatización. Inténtalo de nuevo."),
    [run, navigate]
  );

  const duplicate = useCallback(
    (flow: AutomationSummary) =>
      run(async () => {
        await duplicateAutomation(flow.id);
        onChanged();
      }, `No se pudo duplicar «${flow.name}».`),
    [run, onChanged]
  );

  const setArchived = useCallback(
    (flow: AutomationSummary, archived: boolean) =>
      run(async () => {
        await setAutomationArchived(flow.id, archived);
        onChanged();
      }, archived ? `No se pudo archivar «${flow.name}».` : `No se pudo restaurar «${flow.name}».`),
    [run, onChanged]
  );

  return {
    error,
    busy,
    create,
    duplicate,
    archive: (flow: AutomationSummary) => setArchived(flow, true),
    restore: (flow: AutomationSummary) => setArchived(flow, false)
  };
}
