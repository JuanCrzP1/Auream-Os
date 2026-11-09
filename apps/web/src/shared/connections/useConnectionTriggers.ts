import { useCallback, useEffect, useState } from "react";
import type { ConnectionTrigger, SaveConnectionTriggerRequest } from "@contracts/ConnectionTriggerContracts";
import type { AutomationListResponse } from "@contracts/AutomationContracts";
import { builderApiClient } from "@shared/http/builderApiClient";
import { createTrigger, deleteTrigger, fetchTriggers, updateTrigger } from "./connectionTriggersApi";

export interface FlowOption {
  readonly id: string;
  readonly name: string;
}

export type TriggersStatus = "loading" | "ready" | "error";

/** Los disparadores de un número y los flujos que se pueden elegir (sin archivados). */
export function useConnectionTriggers(connectionId: string) {
  const [triggers, setTriggers] = useState<ConnectionTrigger[]>([]);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [status, setStatus] = useState<TriggersStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      const [list, catalog] = await Promise.all([fetchTriggers(connectionId), builderApiClient.get<AutomationListResponse>("/automations")]);
      setTriggers(list);
      setFlows(catalog.flows.filter((flow) => flow.status !== "archived").map((flow) => ({ id: flow.id, name: flow.name })));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [connectionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (request: SaveConnectionTriggerRequest) => {
      const created = await createTrigger(connectionId, request);
      await refresh();
      return created;
    },
    [connectionId, refresh]
  );
  const update = useCallback(
    async (id: string, request: Partial<SaveConnectionTriggerRequest>) => {
      const updated = await updateTrigger(connectionId, id, request);
      setTriggers((current) => current.map((trigger) => (trigger.id === id ? updated : trigger)));
      return updated;
    },
    [connectionId]
  );
  const remove = useCallback(
    async (id: string) => {
      await deleteTrigger(connectionId, id);
      setTriggers((current) => current.filter((trigger) => trigger.id !== id));
    },
    [connectionId]
  );

  return { triggers, flows, status, refresh, create, update, remove };
}
