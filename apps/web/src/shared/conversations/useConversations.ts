import { useCallback, useEffect, useRef, useState } from "react";
import { CONVERSATIONS_POLL_INTERVAL_MS, type ConversationListQuery, type ConversationSummary } from "@contracts/ConversationContracts";
import { RequestError } from "@shared/http/RequestError";
import { fetchConversations } from "./conversationsApi";

export type InboxStatus = "loading" | "ready" | "forbidden" | "error";

const activity = (chat: ConversationSummary) => chat.lastMessageAt ?? chat.createdAt;

/** Primera página (al día) + páginas anteriores ya cargadas, sin repetidos y en orden. */
function merge(head: ReadonlyArray<ConversationSummary>, older: ReadonlyArray<ConversationSummary>): ConversationSummary[] {
  const seen = new Set(head.map((chat) => chat.id));
  return [...head, ...older.filter((chat) => !seen.has(chat.id))].sort(
    (a, b) => activity(b).localeCompare(activity(a)) || b.id.localeCompare(a.id)
  );
}

/**
 * Los chats de la bandeja, al día y por páginas: la primera página se vuelve
 * a pedir cada pocos segundos (las funciones de Vercel no mantienen
 * conexiones abiertas); «Ver más chats» trae las siguientes con su cursor.
 * Cambiar un filtro empieza de cero. Un fallo suelto mientras ya hay datos
 * no tumba la lista.
 */
export function useConversations(query: ConversationListQuery) {
  const key = JSON.stringify(query);
  const [head, setHead] = useState<ConversationSummary[]>([]);
  const [older, setOlder] = useState<ConversationSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState<InboxStatus>("loading");
  const [filtering, setFiltering] = useState(false);
  const loaded = useRef(false);
  const current = useRef(key);
  const olderLoaded = useRef(false);

  const refresh = useCallback(async () => {
    const requested = key;
    try {
      const page = await fetchConversations(JSON.parse(requested) as ConversationListQuery);
      if (current.current !== requested) return;
      setHead([...page.conversations]);
      // El cursor de la primera página solo manda mientras no se hayan pedido más.
      if (!olderLoaded.current) setCursor(page.nextCursor);
      loaded.current = true;
      setStatus("ready");
      setFiltering(false);
    } catch (error) {
      if (current.current !== requested) return;
      setFiltering(false);
      if (error instanceof RequestError && error.status === 403) setStatus("forbidden");
      else if (!loaded.current) setStatus("error");
    }
  }, [key]);

  useEffect(() => {
    current.current = key;
    olderLoaded.current = false;
    setOlder([]);
    setCursor(null);
    if (loaded.current) setFiltering(true);
    void refresh();
    const timer = setInterval(() => void refresh(), CONVERSATIONS_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [key, refresh]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    const requested = key;
    setLoadingMore(true);
    try {
      const page = await fetchConversations({ ...(JSON.parse(requested) as ConversationListQuery), cursor });
      if (current.current !== requested) return;
      olderLoaded.current = true;
      setOlder((previous) => [...previous, ...page.conversations]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, key, loadingMore]);

  return {
    conversations: merge(head, older),
    status,
    /** Cargando otra vez tras cambiar un filtro (la lista anterior sigue visible). */
    filtering,
    hasMore: cursor !== null,
    loadingMore,
    loadMore,
    refresh
  };
}
