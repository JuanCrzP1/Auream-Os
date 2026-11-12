import "../components/conversations.css";
import "@shared/ui/controls/controls.css";
import "@shared/ui/page/page.css";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useChatAgents } from "@shared/conversations/useChatAgents";
import { startConversation } from "@shared/conversations/conversationsApi";
import { useConversations } from "@shared/conversations/useConversations";
import { useConnections } from "@shared/connections/useConnections";
import { useLabelCatalog } from "@shared/labels/useLabelCatalog";
import { useProductCatalog } from "@shared/products/useProductCatalog";
import { useQuickReplies } from "@shared/quick-replies/useQuickReplies";
import { StateCard, RetryButton } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { ConversationList } from "../components/ConversationList";
import { ChatView } from "../components/ChatView";
import { ChatsGlyph } from "../components/ChatGlyphs";
import { NewChatDialog } from "../components/new-chat/NewChatDialog";
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
  // `?search=573001112233` (desde la ficha del CRM, «Abrir chat»): la bandeja abre buscando ese cliente.
  const [params] = useSearchParams();
  const initialSearch = params.get("search")?.slice(0, 80) ?? "";
  const [filters, setFilters] = useState<InboxFilters>({ ...EMPTY_FILTERS, search: initialSearch });
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { connections } = useConnections();
  const catalog = useLabelCatalog();
  const quickReplies = useQuickReplies();
  // El catálogo para registrar ventas desde un chat (solo si quien mira puede anotar ventas).
  const productCatalog = useProductCatalog();
  const team = useChatAgents();
  const [newChat, setNewChat] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // «Hoy» / «últimos 7 días» se calculan al cambiar los filtros (no en cada sondeo).
  const query = useMemo(() => toListQuery({ ...filters, search: debouncedSearch }), [filters, debouncedSearch]);
  const inbox = useConversations(query);

  // Si se llegó buscando a un cliente y es un solo chat, se abre directo (una vez).
  const [autoOpened, setAutoOpened] = useState(initialSearch === "");
  useEffect(() => {
    if (autoOpened || inbox.conversations.length === 0) return;
    if (inbox.conversations.length === 1) setSelectedId(inbox.conversations[0]!.id);
    setAutoOpened(true);
  }, [autoOpened, inbox.conversations]);

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
          counts={inbox.counts}
          agents={team.agents}
          meId={team.meId}
          canWrite={inbox.canWrite}
          connections={connections}
          labels={catalog.labels}
          labelsStatus={catalog.status}
          selectedId={selectedId}
          filters={filters}
          filtering={inbox.filtering}
          hasMore={inbox.hasMore}
          loadingMore={inbox.loadingMore}
          onFilters={(next) => setFilters((current) => ({ ...current, ...next }))}
          onClearFilters={() => setFilters((current) => ({ ...EMPTY_FILTERS, tab: current.tab }))}
          onLoadMore={() => void inbox.loadMore()}
          onSelect={setSelectedId}
          onNewChat={() => setNewChat(true)}
        />
        {selectedId ? (
          <ChatView
            key={selectedId}
            conversationId={selectedId}
            labels={catalog.labels}
            labelsStatus={catalog.status}
            quickReplies={quickReplies}
            saleProducts={productCatalog.canRecordSales ? productCatalog.products : null}
            canManage={inbox.canManage}
            canWrite={inbox.canWrite}
            agents={team.agents}
            meId={team.meId}
            infoOpen={infoOpen}
            onInfo={setInfoOpen}
            onBack={() => {
              setSelectedId(null);
              setInfoOpen(false);
            }}
            onDeleted={() => {
              inbox.forget(selectedId);
              setSelectedId(null);
              setInfoOpen(false);
              void inbox.refresh();
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
      {newChat ? (
        <NewChatDialog
          connections={connections}
          quickReplies={quickReplies.replies}
          onClose={() => setNewChat(false)}
          onStart={async (request) => {
            const chat = await startConversation(request);
            setFilters((current) => ({ ...current, tab: "all" }));
            setSelectedId(chat.id);
            void inbox.refresh();
            return chat;
          }}
        />
      ) : null}
    </ConversationsShell>
  );
}
