import { useCallback, useEffect, useState } from "react";
import type { CreateMcpCredentialRequest, McpCredentialSummary, McpServerInfo } from "@contracts/McpContracts";
import { RequestError } from "@shared/http/RequestError";
import { createMcpCredential, fetchMcpCredentials, revokeMcpCredential } from "./mcpApi";

/** Como en las demás integraciones: cargando, lista, sin permiso (403), no disponible (503) o error. */
export type McpCredentialsStatus = "loading" | "ready" | "forbidden" | "unavailable" | "error";

/**
 * useMcpCredentials — la dirección del servidor MCP y las credenciales de la
 * cuenta (crear devuelve el token una vez; revocar). Cada cambio recarga.
 */
export function useMcpCredentials() {
  const [credentials, setCredentials] = useState<McpCredentialSummary[]>([]);
  const [server, setServer] = useState<McpServerInfo | null>(null);
  const [status, setStatus] = useState<McpCredentialsStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      const loaded = await fetchMcpCredentials();
      setServer(loaded.server);
      setCredentials(loaded.credentials);
      setStatus("ready");
    } catch (error) {
      const code = error instanceof RequestError ? error.status : 0;
      setStatus(code === 403 ? "forbidden" : code === 503 ? "unavailable" : "error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (request: CreateMcpCredentialRequest) => {
      const created = await createMcpCredential(request);
      await refresh();
      return created;
    },
    [refresh]
  );

  const revoke = useCallback(
    async (id: string) => {
      await revokeMcpCredential(id);
      await refresh();
    },
    [refresh]
  );

  return { credentials, server, status, refresh, create, revoke };
}
