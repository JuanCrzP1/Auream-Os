import { useCallback, useEffect, useRef, useState } from "react";
import { CONVERSATIONS_POLL_INTERVAL_MS, type ConversationFilter, type ConversationSummary } from "@contracts/ConversationContracts";
import { RequestError } from "@shared/http/RequestError";
import { fetchConversations } from "./conversationsApi";

export type InboxStatus = "loading" | "ready" | "forbidden" | "error";

/**
 * Los chats de la bandeja, al día: se vuelven a pedir cada pocos segundos
 * (las funciones de Vercel no mantienen conexiones abiertas). Un fallo
 * suelto mientras ya hay datos no tumba la lista.
 */
export function useConversations(query: { readonly filter: ConversationFilter; readonly search: string; readonly connectionId: string }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [status, setStatus] = useState<InboxStatus>("loading");
  const loaded = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setConversations(await fetchConversations({ filter: query.filter, search: query.search, ...(query.connectionId ? { connectionId: query.connectionId } : {}) }));
      loaded.current = true;
      setStatus("ready");
    } catch (error) {
      if (error instanceof RequestError && error.status === 403) setStatus("forbidden");
      else if (!loaded.current) setStatus("error");
    }
  }, [query.filter, query.search, query.connectionId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), CONVERSATIONS_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { conversations, status, refresh };
}
