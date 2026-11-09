import "../components/conversations.css";
import "@shared/ui/controls/controls.css";
import { useEffect, useState } from "react";
import type { ConversationFilter } from "@contracts/ConversationContracts";
import { useConversations } from "@shared/conversations/useConversations";
import { useConnections } from "@shared/connections/useConnections";
import { StateCard, RetryButton } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { ConversationList } from "../components/ConversationList";
import { ChatView } from "../components/ChatView";
import { ChatsGlyph } from "../components/ChatGlyphs";

/**
 * ConversationsPage — la bandeja: los chats de los números de WhatsApp de la
 * cuenta, al estilo WhatsApp iOS (claro y oscuro). Lista a la izquierda y el
 * chat abierto a la derecha; en el celular, uno a la vez.
 */
export function ConversationsPage() {
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const inbox = useConversations({ filter, search: debounced, connectionId });
  const { connections } = useConnections();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  if (inbox.status === "forbidden") {
    return (
      <div className="ios-inbox ios-inbox--state">
        <StateCard icon={StateIcons.lock} title="Sin acceso a las conversaciones" description="Tu rol en esta cuenta no permite ver los chats. Pídeselo a un administrador." />
      </div>
    );
  }
  if (inbox.status === "error") {
    return (
      <div className="ios-inbox ios-inbox--state">
        <StateCard
          icon={StateIcons.offline}
          tone="warning"
          role="alert"
          title="No pudimos cargar tus conversaciones"
          description="Revisa tu conexión a internet e inténtalo de nuevo."
          actions={<RetryButton busy={retrying} onRetry={() => { setRetrying(true); void inbox.refresh().finally(() => setRetrying(false)); }} />}
        />
      </div>
    );
  }

  return (
    <div className={`ios-inbox${selectedId ? " has-chat" : ""}`}>
      <ConversationList
        conversations={inbox.conversations}
        connections={connections}
        selectedId={selectedId}
        filter={filter}
        search={search}
        connectionId={connectionId}
        onFilter={setFilter}
        onSearch={setSearch}
        onConnection={setConnectionId}
        onSelect={setSelectedId}
      />
      {selectedId ? (
        <ChatView conversationId={selectedId} onBack={() => setSelectedId(null)} />
      ) : (
        <section className="ios-chat ios-chat--empty">
          <div className="ios-welcome">
            <ChatsGlyph />
            <strong>Tus conversaciones de WhatsApp</strong>
            <span>Elige un chat para ver lo que escribió el cliente y lo que respondió el bot, responder tú o enviarle un flujo.</span>
          </div>
        </section>
      )}
    </div>
  );
}
