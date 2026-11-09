import { useCallback, useEffect, useRef, useState } from "react";
import {
  LIVE_ACTIVE_WINDOW_MS,
  LIVE_POLL_ACTIVE_MS,
  LIVE_POLL_IDLE_MS,
  type ConversationMessage,
  type ConversationSummary
} from "@contracts/ConversationContracts";
import { fetchLive, fetchMessages, markConversationRead, sendAgentMessage, setConversationBot, setConversationLabels, startFlow } from "./conversationsApi";
import { LivePoller } from "./LivePoller";
import { isRecent, mergeThread } from "./mergeThread";

const TIMING = { activeMs: LIVE_POLL_ACTIVE_MS, idleMs: LIVE_POLL_IDLE_MS, activeWindowMs: LIVE_ACTIVE_WINDOW_MS };

/**
 * Un chat abierto, en vivo: cada mensaje aparece apenas sale hacia WhatsApp y
 * sus chulos cambian con los avisos de entregado y leído. Pide solo lo nuevo o
 * cambiado (`since`), más seguido mientras hay movimiento, y nada con la
 * pestaña oculta (`LivePoller`). Al abrirlo (y al llegar mensajes) se marca
 * como leído. «Ver anteriores» trae páginas más antiguas sin perder lo cargado.
 */
export function useConversationThread(id: string) {
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ReadonlyArray<ConversationMessage>>([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  /** Lo que se ve (fuente de verdad para unir lo que llega). */
  const list = useRef<ReadonlyArray<ConversationMessage>>([]);
  const poller = useRef<LivePoller | null>(null);

  useEffect(() => {
    let alive = true;
    let cursor: string | null = null;
    list.current = [];
    setMessages([]);
    setConversation(null);
    setHasMore(false);
    setStatus("loading");

    const show = (next: ReadonlyArray<ConversationMessage>) => {
      list.current = next;
      setMessages(next);
    };

    const tick = async (): Promise<boolean> => {
      const since = cursor;
      try {
        const live = await fetchLive(id, since ?? undefined);
        if (!alive) return false;
        cursor = live.cursor;
        setConversation(live.conversation);
        setStatus("ready");
        if (live.conversation.unreadCount > 0) void markConversationRead(id).catch(() => undefined);
        if (since === null) {
          show(live.messages);
          setHasMore(live.hasMore);
          // Abrir un chat con un flujo en marcha: empieza en movimiento.
          return isRecent(live.messages.at(-1), LIVE_ACTIVE_WINDOW_MS);
        }
        const merged = mergeThread(list.current, live.messages);
        if (merged.changed) show(merged.messages);
        return merged.changed;
      } catch {
        if (alive) setStatus((current) => (current === "ready" ? current : "error"));
        return false;
      }
    };

    const instance = new LivePoller(tick, TIMING);
    poller.current = instance;
    instance.start();
    return () => {
      alive = false;
      instance.stop();
      if (poller.current === instance) poller.current = null;
    };
  }, [id]);

  /** Consulta ya (sin esperar la próxima vuelta) y entra en movimiento. */
  const refresh = useCallback(() => poller.current?.nudge(), []);

  const loadOlder = useCallback(async () => {
    const first = list.current[0];
    if (!first) return;
    const page = await fetchMessages(id, first.id);
    const merged = mergeThread(list.current, page.messages);
    list.current = merged.messages;
    setMessages(merged.messages);
    setHasMore(page.hasMore);
  }, [id]);

  const send = useCallback(async (text: string) => {
    setConversation(await sendAgentMessage(id, text));
    refresh();
  }, [id, refresh]);

  const setBot = useCallback(async (enabled: boolean) => {
    setConversation(await setConversationBot(id, enabled));
  }, [id]);

  const launchFlow = useCallback(async (automationId: string) => {
    // En movimiento desde ya: los mensajes del flujo aparecen mientras salen.
    refresh();
    const result = await startFlow(id, automationId);
    refresh();
    return result;
  }, [id, refresh]);

  const setLabels = useCallback(async (labelIds: ReadonlyArray<string>) => {
    setConversation(await setConversationLabels(id, labelIds));
  }, [id]);

  return { conversation, messages, hasMore, status, refresh, loadOlder, send, setBot, launchFlow, setLabels };
}
