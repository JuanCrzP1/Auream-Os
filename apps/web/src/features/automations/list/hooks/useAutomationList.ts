import { useEffect, useState, useCallback } from "react";
import type { AutomationListResponse } from "@contracts/AutomationContracts";
import { fetchAutomationList } from "../services/fetchAutomationList";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: AutomationListResponse };


export type UseAutomationListResult = State & { refresh: () => void };

/**
 * `tenantId` no se envía a la API —el servidor lo resuelve desde la identidad
 * autenticada—, pero sí es dependencia del efecto: al cambiar de tenant la
 * lista debe recargarse.
 */
export function useAutomationList(tenantId: string): UseAutomationListResult {
  const [state, setState] = useState<State>({ status: "loading" });
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    fetchAutomationList()
      .then((data) => {
        if (!cancelled) setState({ status: "success", data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Error desconocido"
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId, tick]);

  return { ...state, refresh };
}
