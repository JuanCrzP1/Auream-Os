import type { ChatAgent } from "@contracts/ConversationContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";

type Notice = { readonly kind: "error" | "info"; readonly text: string } | null;

interface ChatThreadActions {
  readonly take: () => Promise<unknown>;
  readonly assign: (assigneeId: string | null) => Promise<unknown>;
  readonly resolve: () => Promise<unknown>;
  readonly setBot: (enabled: boolean) => Promise<unknown>;
  readonly react: (messageId: string, emoji: string) => Promise<unknown>;
}

/**
 * Lo que el asesor hace sobre el chat abierto (tomar, pasar, resolver, el
 * bot, reaccionar) y lo que se le dice, bien o mal, sin perder el chat.
 */
export function chatActions(thread: ChatThreadActions, botEnabled: boolean, agents: ReadonlyArray<ChatAgent>, meId: string | null, setNotice: (notice: Notice) => void) {
  const attend = async (run: () => Promise<unknown>, done: string, failed: string) => {
    setNotice(null);
    try {
      await run();
      setNotice({ kind: "info", text: done });
    } catch (e) {
      setNotice({ kind: "error", text: apiErrorMessage(e, failed) });
    }
  };
  const nameOf = (id: string) => (id === meId ? "ti" : (agents.find((agent) => agent.userId === id)?.name ?? "otro asesor"));

  const quiet = async (run: () => Promise<unknown>, failed: string) => {
    setNotice(null);
    try {
      await run();
    } catch (e) {
      setNotice({ kind: "error", text: apiErrorMessage(e, failed) });
    }
  };

  return {
    toggleBot: () => void quiet(() => thread.setBot(!botEnabled), "No se pudo cambiar el bot."),
    react: (messageId: string, emoji: string) => void quiet(() => thread.react(messageId, emoji), "No se pudo reaccionar al mensaje."),
    onTake: () => void attend(thread.take, "Tomaste el chat: queda a tu nombre y el bot está en pausa.", "No se pudo tomar el chat."),
    onAssign: (assigneeId: string | null) =>
      void attend(() => thread.assign(assigneeId), assigneeId ? `El chat quedó a cargo de ${nameOf(assigneeId)}.` : "El chat quedó sin asignar, en espera.", "No se pudo pasar el chat."),
    onResolve: () => void attend(thread.resolve, "Chat resuelto. El bot vuelve a atender; si el cliente escribe, se reabre.", "No se pudo resolver el chat.")
  };
}
