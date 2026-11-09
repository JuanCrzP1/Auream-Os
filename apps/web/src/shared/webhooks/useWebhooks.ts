import { useCallback, useEffect, useState } from "react";
import type { CreateWebhookRequest, WebhookSummary } from "@contracts/WebhookContracts";
import { RequestError } from "@shared/http/RequestError";
import { createWebhook, deleteWebhook, fetchWebhooks } from "./webhooksApi";

/** Como en las demás integraciones: cargando, lista, sin permiso (403), sin cifrado (503) o error. */
export type WebhooksStatus = "loading" | "ready" | "forbidden" | "unavailable" | "error";

/**
 * useWebhooks — los webhooks de entrada de la cuenta (lista, crear, borrar).
 * La lista del servidor es la única verdad: cada cambio vuelve a cargarla.
 */
export function useWebhooks() {
  const [webhooks, setWebhooks] = useState<WebhookSummary[]>([]);
  const [status, setStatus] = useState<WebhooksStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      setWebhooks(await fetchWebhooks());
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
    async (request: CreateWebhookRequest) => {
      const created = await createWebhook(request);
      await refresh();
      return created;
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteWebhook(id);
      await refresh();
    },
    [refresh]
  );

  return { webhooks, status, refresh, create, remove };
}
