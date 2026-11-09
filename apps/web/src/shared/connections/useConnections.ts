import { useCallback, useEffect, useState } from "react";
import type { ConnectionSummary, CreateConnectionRequest } from "@contracts/ConnectionContracts";
import { RequestError } from "@shared/http/RequestError";
import { createConnection, deleteConnection, fetchConnections, linkConnection, renameConnection } from "./connectionsApi";

/**
 *   loading · ready · error
 *   forbidden   el rol del usuario no puede ver las conexiones
 */
export type ConnectionsStatus = "loading" | "ready" | "forbidden" | "error";

/** Los números de WhatsApp de la cuenta y sus operaciones. La lista del servidor manda. */
export function useConnections() {
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [status, setStatus] = useState<ConnectionsStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      setConnections(await fetchConnections());
      setStatus("ready");
    } catch (error) {
      setStatus(error instanceof RequestError && error.status === 403 ? "forbidden" : "error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (request: CreateConnectionRequest) => {
      const created = await createConnection(request);
      await refresh();
      return created;
    },
    [refresh]
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      const renamed = await renameConnection(id, { name });
      await refresh();
      return renamed;
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteConnection(id);
      await refresh();
    },
    [refresh]
  );

  const link = useCallback(
    async (id: string) => {
      const state = await linkConnection(id);
      await refresh();
      return state;
    },
    [refresh]
  );

  return { connections, status, refresh, create, rename, remove, link };
}
