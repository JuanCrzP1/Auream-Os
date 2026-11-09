import "../components/conversations.css";
import "@shared/ui/controls/controls.css";
import "@shared/ui/page/page.css";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useConversations } from "@shared/conversations/useConversations";
import { useConnections } from "@shared/connections/useConnections";
import { useLabelCatalog } from "@shared/labels/useLabelCatalog";
import { StateCard, RetryButton } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { ConversationList } from "../components/ConversationList";
import { ChatView } from "../components/ChatView";
import { ChatsGlyph } from "../components/ChatGlyphs";
import { EMPTY_FILTERS, toListQuery, type InboxFilters } from "../model/inboxFilters";

/** Cabecera estándar de los módulos (la misma de Automatizaciones, Contactos…). */
function ConversationsShell({ chatOpen = false, children }: { readonly chatOpen?: boolean; readonly children: ReactNode }) {
  return (
    <div className={`ui-page conversations-page${chatOpen ? " has-chat" : ""}`}>
      <header className="ui-page__header">
        <div>
          <h1 className="ui-page__title">Conversaciones</h1>
          <p className="ui-page__subtitle">Los chats de tus números de WhatsApp: responde, etiqueta y ejecuta flujos.</p>
        </div>
      </header>
      {children}
    </div>
  );
}

/**
 * ConversationsPage — la bandeja: los chats de los números de WhatsApp de la
 * cuenta, al estilo WhatsApp iOS (claro y oscuro). Lista con filtros a la
 * izquierda, el chat abierto en el centro y su info a la derecha; en el
 * celular, una cosa a la vez.
 */
export function ConversationsPage() {
  const [filters, setFilters] = useState<InboxFilters>(EMPTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { connections } = useConnections();
  const catalog = useLabelCatalog();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // «Hoy» / «últimos 7 días» se calculan al cambiar los filtros (no en cada sondeo).
  const query = useMemo(() => toListQuery({ ...filters, search: debouncedSearch }), [filters, debouncedSearch]);
  const inbox = useConversations(query);

  if (inbox.status === "forbidden") {
    return (
      <ConversationsShell>
        <div className="ios-inbox ios-inbox--state">
          <StateCard icon={StateIcons.lock} title="Sin acceso a las conversaciones" description="Tu rol en esta cuenta no permite ver los chats. Pídeselo a un administrador." />
        </div>
      </ConversationsShell>
    );
  }
  if (inbox.status === "error") {
    return (
      <ConversationsShell>
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
      </ConversationsShell>
    );
  }

  const layout = ["ios-inbox", selectedId ? "has-chat" : "", selectedId && infoOpen ? "has-info" : ""].filter(Boolean).join(" ");

  return (
    <ConversationsShell chatOpen={Boolean(selectedId)}>
      <div className={layout}>
        <ConversationList
          conversations={inbox.conversations}
          connections={connections}
          labels={catalog.labels}
          labelsStatus={catalog.status}
          selectedId={selectedId}
          filters={filters}
          filtering={inbox.filtering}
          hasMore={inbox.hasMore}
          loadingMore={inbox.loadingMore}
          onFilters={(next) => setFilters((current) => ({ ...current, ...next }))}
          onClearFilters={() => setFilters(EMPTY_FILTERS)}
          onLoadMore={() => void inbox.loadMore()}
          onSelect={setSelectedId}
        />
        {selectedId ? (
          <ChatView
            key={selectedId}
            conversationId={selectedId}
            labels={catalog.labels}
            labelsStatus={catalog.status}
            infoOpen={infoOpen}
            onInfo={setInfoOpen}
            onBack={() => {
              setSelectedId(null);
              setInfoOpen(false);
            }}
            onCreateLabel={catalog.create}
          />
        ) : (
          <section className="ios-chat ios-chat--empty">
            <div className="ios-welcome">
              <ChatsGlyph />
              <strong>Tus conversaciones de WhatsApp</strong>
              <span>Elige un chat para ver lo que escribió el cliente y lo que respondió el bot, responder tú, etiquetarlo o ejecutarle un flujo.</span>
            </div>
          </section>
        )}
      </div>
    </ConversationsShell>
  );
}
