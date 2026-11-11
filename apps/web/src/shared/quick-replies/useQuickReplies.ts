import { useCallback, useEffect, useState } from "react";
import type { QuickReply, SaveQuickReplyRequest } from "@contracts/QuickReplyContracts";
import { createQuickReply, deleteQuickReply, fetchQuickReplies, updateQuickReply } from "./quickRepliesApi";

export type QuickRepliesStatus = "loading" | "ready" | "error";

/**
 * Las respuestas rápidas de la cuenta: se cargan una vez al abrir la bandeja
 * y se mantienen al día con lo que crea, edita o borra quien mira.
 */
export function useQuickReplies() {
  const [replies, setReplies] = useState<ReadonlyArray<QuickReply>>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [status, setStatus] = useState<QuickRepliesStatus>("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetchQuickReplies();
      setReplies(response.quickReplies);
      setCanWrite(response.canWrite);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (request: SaveQuickReplyRequest, id?: string) => {
    const saved = id ? await updateQuickReply(id, request) : await createQuickReply(request);
    setReplies((current) => (id ? current.map((reply) => (reply.id === id ? saved : reply)) : [saved, ...current]));
    return saved;
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteQuickReply(id);
    setReplies((current) => current.filter((reply) => reply.id !== id));
  }, []);

  return { replies, canWrite, status, reload: load, save, remove };
}
