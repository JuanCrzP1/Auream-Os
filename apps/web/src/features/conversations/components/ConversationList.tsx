import type { ConversationFilter, ConversationSummary } from "@contracts/ConversationContracts";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import { formatPhone } from "@shared/phone/formatPhone";
import { Avatar } from "./Avatar";
import { listTime } from "./chatTime";
import { BotGlyph, ChatsGlyph, SearchGlyph } from "./ChatGlyphs";

// ---------------------------------------------------------------------------
// Lista de chats al estilo WhatsApp iOS: título grande, buscador, filtros y
// cada chat con su avatar, nombre, último mensaje, hora y no leídos.
// ---------------------------------------------------------------------------

const FILTERS: ReadonlyArray<{ readonly value: ConversationFilter; readonly label: string }> = [
  { value: "all", label: "Todos" },
  { value: "unread", label: "No leídos" },
  { value: "bot_paused", label: "Atendidos por asesor" }
];

const AUTHOR_PREFIX = { contact: "", bot: "🤖 ", agent: "Tú: " } as const;

export function displayName(conversation: Pick<ConversationSummary, "contactName" | "phone">): string {
  return conversation.contactName?.trim() || formatPhone(conversation.phone).text;
}

export function ConversationList({
  conversations,
  connections,
  selectedId,
  filter,
  search,
  connectionId,
  onFilter,
  onSearch,
  onConnection,
  onSelect
}: {
  readonly conversations: ReadonlyArray<ConversationSummary>;
  readonly connections: ReadonlyArray<ConnectionSummary>;
  readonly selectedId: string | null;
  readonly filter: ConversationFilter;
  readonly search: string;
  readonly connectionId: string;
  readonly onFilter: (filter: ConversationFilter) => void;
  readonly onSearch: (search: string) => void;
  readonly onConnection: (connectionId: string) => void;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <section className="ios-list" aria-label="Chats">
      <header className="ios-list__header">
        <h1 className="ios-list__title">Conversaciones</h1>
        <label className="ios-search">
          <SearchGlyph />
          <input type="search" value={search} placeholder="Buscar por nombre o número" aria-label="Buscar chats" onChange={(event) => onSearch(event.target.value)} />
        </label>
        <div className="ios-filters" role="tablist" aria-label="Filtrar chats">
          {FILTERS.map((option) => (
            <button key={option.value} type="button" role="tab" aria-selected={filter === option.value} className="ios-chip" onClick={() => onFilter(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
        {connections.length > 1 ? (
          <select className="ios-connection" value={connectionId} aria-label="Número de WhatsApp" onChange={(event) => onConnection(event.target.value)}>
            <option value="">Todos los números</option>
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name}
              </option>
            ))}
          </select>
        ) : null}
      </header>

      {conversations.length === 0 ? (
        <div className="ios-list__empty">
          <ChatsGlyph />
          <strong>{search || filter !== "all" ? "Sin resultados" : "Aún no hay chats"}</strong>
          <span>{search || filter !== "all" ? "Prueba con otro filtro o búsqueda." : "Cuando un cliente escriba a uno de tus números, su chat aparece aquí."}</span>
        </div>
      ) : (
        <ul className="ios-list__items">
          {conversations.map((conversation) => {
            const name = displayName(conversation);
            const prefix = conversation.lastMessageAuthor ? AUTHOR_PREFIX[conversation.lastMessageAuthor] : "";
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  className={`ios-row${conversation.id === selectedId ? " is-selected" : ""}`}
                  aria-current={conversation.id === selectedId ? "true" : undefined}
                  aria-label={`${name}${conversation.unreadCount ? `, ${conversation.unreadCount} sin leer` : ""}`}
                  onClick={() => onSelect(conversation.id)}
                >
                  <Avatar name={conversation.contactName} phone={conversation.phone} />
                  <span className="ios-row__body">
                    <span className="ios-row__top">
                      <span className="ios-row__name">{name}</span>
                      <span className={`ios-row__time${conversation.unreadCount ? " is-unread" : ""}`}>{listTime(conversation.lastMessageAt)}</span>
                    </span>
                    <span className="ios-row__bottom">
                      <span className="ios-row__preview">
                        {prefix}
                        {conversation.lastMessageText || "Sin mensajes"}
                      </span>
                      {!conversation.botEnabled ? (
                        <span className="ios-row__paused" title="Atendido por un asesor (bot pausado)">
                          <BotGlyph />
                        </span>
                      ) : null}
                      {conversation.unreadCount ? <span className="ios-badge">{conversation.unreadCount}</span> : null}
                    </span>
                    {connections.length > 1 ? <span className="ios-row__connection">{conversation.connectionName}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
