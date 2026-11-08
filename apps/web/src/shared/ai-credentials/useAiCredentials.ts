import { useCallback, useEffect, useState } from "react";
import type { AiCredentialSummary, CreateAiCredentialRequest, UpdateAiCredentialRequest } from "@contracts/AiContracts";
import { RequestError } from "@shared/http/RequestError";
import { createAiCredential, deleteAiCredential, fetchAiCredentials, updateAiCredential, verifyAiCredential } from "./aiCredentialsApi";

/**
 *   loading      cargando
 *   ready        lista cargada
 *   forbidden    el usuario no puede ver las conexiones (403)
 *   unavailable  el servidor no tiene configurado el cifrado (503)
 *   error        otro fallo (red, servidor)
 */
export type AiCredentialsStatus = "loading" | "ready" | "forbidden" | "unavailable" | "error";

/**
 * useAiCredentials — las conexiones de IA de la cuenta y sus operaciones.
 * La lista del servidor es la única verdad: cada cambio vuelve a cargarla.
 */
export function useAiCredentials() {
  const [credentials, setCredentials] = useState<AiCredentialSummary[]>([]);
  const [status, setStatus] = useState<AiCredentialsStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      setCredentials(await fetchAiCredentials());
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
    async (request: CreateAiCredentialRequest) => {
      const created = await createAiCredential(request);
      await refresh();
      return created;
    },
    [refresh]
  );

  const update = useCallback(
    async (id: string, request: UpdateAiCredentialRequest) => {
      const updated = await updateAiCredential(id, request);
      await refresh();
      return updated;
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteAiCredential(id);
      await refresh();
    },
    [refresh]
  );

  const verify = useCallback(
    async (id: string) => {
      const verified = await verifyAiCredential(id);
      await refresh();
      return verified;
    },
    [refresh]
  );

  return { credentials, status, refresh, create, update, remove, verify };
}
