import { useCallback, useEffect, useState } from "react";
import type { ConnectionSummary, CreateConnectionRequest } from "@contracts/ConnectionContracts";
import { RequestError } from "@shared/http/RequestError";
import { checkConnection, createConnection, deleteConnection, disconnectConnection, fetchConnections, linkConnection, renameConnection, restartConnection } from "./connectionsApi";

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
    async (id: string, restart = false) => {
      const state = await linkConnection(id, restart);
      await refresh();
      return state;
    },
    [refresh]
  );

  /** Consulta la vinculación; recarga la lista solo si el estado cambió. */
  const check = useCallback(
    async (id: string) => {
      const state = await checkConnection(id);
      setConnections((current) => {
        const before = current.find((connection) => connection.id === id);
        return before && before.status === state.connection.status && before.phoneNumber === state.connection.phoneNumber
          ? current
          : current.map((connection) => (connection.id === id ? { ...state.connection, triggerCount: connection.triggerCount } : connection));
      });
      return state;
    },
    []
  );

  const disconnect = useCallback(
    async (id: string) => {
      await disconnectConnection(id);
      await refresh();
    },
    [refresh]
  );

  const restart = useCallback(async (id: string) => {
    await restartConnection(id);
  }, []);

  return { connections, status, refresh, create, rename, remove, link, check, disconnect, restart };
}
