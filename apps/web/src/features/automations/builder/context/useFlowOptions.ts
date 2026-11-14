import { useCallback, useEffect, useState } from "react";
import { fetchAutomationList } from "@features/automations/list/services/fetchAutomationList";
import type { ToolAiCredentialsStatus, ToolFlowOption } from "../tools/ToolResources";

/**
 * Los flujos de la cuenta, para «Ir a otro flujo». Se cargan una vez al abrir
 * el editor y se vuelven a pedir con `refresh` (al volver a la pestaña: un
 * flujo pudo crearse o pausarse en otra).
 */
export function useFlowOptions() {
  const [flows, setFlows] = useState<ReadonlyArray<ToolFlowOption>>([]);
  const [status, setStatus] = useState<ToolAiCredentialsStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAutomationList();
      setFlows(data.flows.map(({ id, key, name, status: flowStatus }) => ({ id, key, name, status: flowStatus })));
      setStatus("ready");
    } catch {
      setStatus((current) => (current === "ready" ? current : "error"));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { flows, status, refresh };
}
