import { useEffect, useRef, useState, useCallback } from "react";
import type { AutomationListResponse } from "@contracts/AutomationContracts";
import { fetchAutomationList } from "../services/fetchAutomationList";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "success";
      data: AutomationListResponse;
      /** Falló una revalidación, pero `data` sigue siendo lo último bueno. */
      refreshError: string | null;
    };

export type UseAutomationListResult = State & {
  refresh: () => void;
  /** Hay una revalidación en vuelo sobre datos ya visibles. */
  isRefreshing: boolean;
};

/**
 * `tenantId` no se envía a la API —el servidor lo resuelve desde la identidad
 * autenticada—, pero sí es dependencia del efecto: al cambiar de tenant la
 * lista debe recargarse.
 *
 * Distingue carga inicial de revalidación:
 *
 *  - Primera carga (o cambio de tenant): `loading`, sin datos en pantalla.
 *    En un cambio de tenant vaciar es obligatorio, no cosmético: los datos
 *    del tenant anterior no pueden seguir visibles ni un frame.
 *  - `refresh()` sobre datos ya cargados: la lista permanece montada y sólo
 *    se marca `isRefreshing`. Si la revalidación falla, `data` no se toca y
 *    el fallo viaja en `refreshError`.
 */
export function useAutomationList(tenantId: string): UseAutomationListResult {
  const [state, setState] = useState<State>({ status: "loading" });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const loadedTenant = useRef<string | null>(null);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const isFirstLoadForTenant = loadedTenant.current !== tenantId;

    if (isFirstLoadForTenant) {
      setState({ status: "loading" });
    } else {
      setIsRefreshing(true);
    }

    fetchAutomationList()
      .then((data) => {
        if (cancelled) return;
        loadedTenant.current = tenantId;
        setState({ status: "success", data, refreshError: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Error desconocido";

        setState((previous) =>
          previous.status === "success"
            ? { ...previous, refreshError: message }
            : { status: "error", message }
        );
      })
      .finally(() => {
        if (!cancelled) setIsRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId, tick]);

  return { ...state, refresh, isRefreshing };
}
