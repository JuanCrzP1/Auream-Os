import { useCallback, useEffect, useState } from "react";
import type { CrmMember, PipelineSummary, SavePipelineRequest } from "@contracts/CrmContracts";
import { RequestError } from "@shared/http/RequestError";
import { crmApi } from "../services/crmApi";

export type PipelinesStatus = "loading" | "ready" | "forbidden" | "unavailable" | "error";

/**
 * Los embudos de la cuenta, el equipo que puede atender y qué puede hacer
 * quien mira. La lista del servidor manda: tras cada cambio se vuelve a pedir.
 * Al abrir, un fallo pasajero (la sesión renovándose) se reintenta solo.
 */
export function usePipelines() {
  const [pipelines, setPipelines] = useState<ReadonlyArray<PipelineSummary>>([]);
  const [members, setMembers] = useState<ReadonlyArray<CrmMember>>([]);
  const [permissions, setPermissions] = useState({ canWrite: false, canManage: false });
  const [status, setStatus] = useState<PipelinesStatus>("loading");

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const response = await crmApi.pipelines();
      setPipelines(response.pipelines);
      setMembers(response.members);
      setPermissions({ canWrite: response.canWrite, canManage: response.canManage });
      setStatus("ready");
      return true;
    } catch (error) {
      const code = error instanceof RequestError ? error.status : 0;
      setStatus(code === 403 ? "forbidden" : code === 503 ? "unavailable" : "error");
      return code === 403 || code === 503;
    }
  }, []);

  useEffect(() => {
    let timer = 0;
    let alive = true;
    const load = async (attempt: number) => {
      if ((await refresh()) || !alive || attempt >= 3) return;
      timer = window.setTimeout(() => void load(attempt + 1), 2000 * 2 ** attempt);
    };
    void load(0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [refresh]);

  const createStarter = useCallback(async () => {
    const created = await crmApi.createStarter();
    await refresh();
    return created;
  }, [refresh]);

  const save = useCallback(
    async (pipelineId: string | null, request: SavePipelineRequest) => {
      const saved = pipelineId ? await crmApi.updatePipeline(pipelineId, request) : await crmApi.createPipeline(request);
      await refresh();
      return saved;
    },
    [refresh]
  );

  const remove = useCallback(
    async (pipelineId: string) => {
      await crmApi.removePipeline(pipelineId);
      await refresh();
    },
    [refresh]
  );

  return { pipelines, members, ...permissions, status, refresh, createStarter, save, remove };
}
