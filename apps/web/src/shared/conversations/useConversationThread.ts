import { useCallback, useEffect, useRef, useState } from "react";
import { CONVERSATIONS_POLL_INTERVAL_MS, type ConversationMessage, type ConversationSummary } from "@contracts/ConversationContracts";
import { fetchConversation, fetchMessages, markConversationRead, sendAgentMessage, setConversationBot, startFlow } from "./conversationsApi";

/**
 * Un chat abierto: su cabecera y su hilo al día. Al abrirlo (y al llegar
 * mensajes nuevos) se marca como leído. «Ver anteriores» trae páginas más
 * antiguas sin perder lo cargado.
 */
export function useConversationThread(id: string) {
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const older = useRef<ConversationMessage[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [summary, page] = await Promise.all([fetchConversation(id), fetchMessages(id)]);
      setConversation(summary);
      setMessages([...older.current.filter((m) => !page.messages.some((n) => n.id === m.id)), ...page.messages]);
      if (older.current.length === 0) setHasMore(page.hasMore);
      setStatus("ready");
      if (summary.unreadCount > 0) void markConversationRead(id).catch(() => undefined);
    } catch {
      setStatus((current) => (current === "ready" ? current : "error"));
    }
  }, [id]);

  useEffect(() => {
    older.current = [];
    setStatus("loading");
    setMessages([]);
    void refresh();
    const timer = setInterval(() => void refresh(), CONVERSATIONS_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const loadOlder = useCallback(async () => {
    const first = messages[0];
    if (!first) return;
    const page = await fetchMessages(id, first.id);
    older.current = [...page.messages, ...older.current];
    setMessages((current) => [...page.messages, ...current]);
    setHasMore(page.hasMore);
  }, [id, messages]);

  const send = useCallback(async (text: string) => {
    setConversation(await sendAgentMessage(id, text));
    await refresh();
  }, [id, refresh]);

  const setBot = useCallback(async (enabled: boolean) => {
    setConversation(await setConversationBot(id, enabled));
  }, [id]);

  const launchFlow = useCallback(async (automationId: string) => {
    const result = await startFlow(id, automationId);
    await refresh();
    return result;
  }, [id, refresh]);

  return { conversation, messages, hasMore, status, refresh, loadOlder, send, setBot, launchFlow };
}
