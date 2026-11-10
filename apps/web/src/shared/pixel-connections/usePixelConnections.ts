import { useCallback, useEffect, useState } from "react";
import type { CreatePixelConnectionRequest, PixelConnectionSummary, UpdatePixelConnectionRequest } from "@contracts/PixelContracts";
import { RequestError } from "@shared/http/RequestError";
import { createPixelConnection, deletePixelConnection, fetchPixelConnections, updatePixelConnection, verifyPixelConnection } from "./pixelConnectionsApi";

/** Mismo significado que en las conexiones de IA. */
export type PixelConnectionsStatus = "loading" | "ready" | "forbidden" | "unavailable" | "error";

/** Los píxeles de Meta de la cuenta y sus operaciones. La lista del servidor manda. */
export function usePixelConnections() {
  const [connections, setConnections] = useState<PixelConnectionSummary[]>([]);
  const [status, setStatus] = useState<PixelConnectionsStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      setConnections(await fetchPixelConnections());
      setStatus("ready");
    } catch (error) {
      const code = error instanceof RequestError ? error.status : 0;
      setStatus(code === 403 ? "forbidden" : code === 503 ? "unavailable" : "error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const after = useCallback(<T,>(run: () => Promise<T>) => async () => {
    const value = await run();
    await refresh();
    return value;
  }, [refresh]);

  const create = useCallback((request: CreatePixelConnectionRequest) => after(() => createPixelConnection(request))(), [after]);
  const update = useCallback((id: string, request: UpdatePixelConnectionRequest) => after(() => updatePixelConnection(id, request))(), [after]);
  const remove = useCallback((id: string) => after(() => deletePixelConnection(id))(), [after]);
  const verify = useCallback((id: string) => after(() => verifyPixelConnection(id))(), [after]);

  return { connections, status, refresh, create, update, remove, verify };
}

/** Los píxeles y sus operaciones, tal como los entrega el hook (para pasarlos de la página a sus secciones). */
export type PixelConnections = ReturnType<typeof usePixelConnections>;
