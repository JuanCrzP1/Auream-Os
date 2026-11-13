import { useCallback, useEffect, useState } from "react";
import type { CreateLabelRequest, UpdateLabelRequest } from "@contracts/ContactContracts";
import type { LabelsOverviewResponse, MergeLabelsRequest } from "@contracts/LabelManagementContracts";
import { RequestError } from "@shared/http/RequestError";
import { createLabel, deleteLabel, fetchLabelsOverview, mergeLabels, updateLabel } from "./labelsApi";

export type LabelsOverviewStatus = "loading" | "ready" | "forbidden" | "error";

/** Mientras una unión sigue, la lista se vuelve a pedir cada tanto para mostrar el avance. */
const POLL_MS = 2500;

/**
 * Configuración › Etiquetas: el catálogo con quién usa cada una, las repetidas
 * y las uniones en curso. Tras cada cambio se vuelve a pedir (los usos y los
 * conteos los calcula el servidor), sin volver a «cargando».
 */
export function useLabelsOverview() {
  const [data, setData] = useState<LabelsOverviewResponse | null>(null);
  const [status, setStatus] = useState<LabelsOverviewStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      setData(await fetchLabelsOverview());
      setStatus("ready");
    } catch (error) {
      const forbidden = error instanceof RequestError && error.status === 403;
      setStatus((current) => (forbidden ? "forbidden" : current === "ready" ? current : "error"));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const running = data?.merges.some((merge) => merge.status === "running") ?? false;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [running, refresh]);

  const reload = useCallback(async () => {
    setStatus("loading");
    await refresh();
  }, [refresh]);

  const create = useCallback(async (request: CreateLabelRequest) => {
    const created = await createLabel(request);
    await refresh();
    return created;
  }, [refresh]);

  const update = useCallback(async (id: string, request: UpdateLabelRequest) => {
    const updated = await updateLabel(id, request);
    await refresh();
    return updated;
  }, [refresh]);

  const merge = useCallback(async (request: MergeLabelsRequest) => {
    const result = await mergeLabels(request);
    await refresh();
    return result;
  }, [refresh]);

  const remove = useCallback(async (id: string, into?: string) => {
    const result = await deleteLabel(id, into);
    await refresh();
    return result;
  }, [refresh]);

  return { data, status, refresh, reload, create, update, merge, remove };
}
