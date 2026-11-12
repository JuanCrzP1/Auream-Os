import { useEffect, useState } from "react";
import type { ChatAgent } from "@contracts/ConversationContracts";
import { fetchChatAgents } from "./conversationsApi";

/**
 * Quién puede atender chats (para «Pasar a…» y el filtro por responsable) y
 * quién mira. Se pide una vez al abrir la bandeja; si falla, la bandeja sigue
 * funcionando sin esas opciones.
 */
export function useChatAgents() {
  const [agents, setAgents] = useState<ReadonlyArray<ChatAgent>>([]);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchChatAgents()
      .then((response) => {
        if (!alive) return;
        setAgents(response.agents);
        setMeId(response.meId);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return { agents, meId };
}
