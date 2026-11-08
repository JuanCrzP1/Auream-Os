import { useCallback, useEffect, useState } from "react";
import type { CreateLabelRequest, LabelSummary, UpdateLabelRequest } from "@contracts/ContactContracts";
import { createLabel, deleteLabel, fetchLabels, updateLabel } from "./labelsApi";

export type LabelCatalogStatus = "loading" | "ready" | "error";

/**
 * useLabelCatalog — el catálogo de etiquetas de la cuenta y sus operaciones.
 * La lista del servidor es la única verdad: cada cambio vuelve a cargarla.
 */
export function useLabelCatalog() {
  const [labels, setLabels] = useState<LabelSummary[]>([]);
  const [status, setStatus] = useState<LabelCatalogStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      setLabels(await fetchLabels());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(async (request: CreateLabelRequest) => {
    const created = await createLabel(request);
    await refresh();
    return created;
  }, [refresh]);

  const update = useCallback(async (id: string, request: UpdateLabelRequest) => {
    await updateLabel(id, request);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await deleteLabel(id);
    await refresh();
  }, [refresh]);

  return { labels, status, refresh, create, update, remove };
}
