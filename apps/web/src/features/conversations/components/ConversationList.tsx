import { useId, useState } from "react";
import type { ConversationSummary } from "@contracts/ConversationContracts";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import type { LabelSummary } from "@contracts/ContactContracts";
import { formatPhone } from "@shared/phone/formatPhone";
import { dateLabel, isFiltered, panelFilterCount, STATUS_OPTIONS, type InboxFilters } from "../model/inboxFilters";
import { Avatar } from "./Avatar";
import { listTime } from "./chatTime";
import { BotGlyph, ChatsGlyph, CloseGlyph, FilterGlyph, SearchGlyph } from "./ChatGlyphs";
import { ChatLabels } from "./ChatLabels";
import { InboxFiltersPanel } from "./InboxFiltersPanel";

// ---------------------------------------------------------------------------
// Lista de chats al estilo WhatsApp iOS: título grande, buscador, estado
// (Todos / No leídos / Con bot / Con asesor) y el panel «Filtros» (número,
// etiquetas, fecha). Cada chat con avatar, nombre, último mensaje, hora, no
// leídos y sus etiquetas. Por páginas: «Ver más chats».
// ---------------------------------------------------------------------------

const AUTHOR_PREFIX = { contact: "", bot: "🤖 ", agent: "Tú: " } as const;

export function displayName(conversation: Pick<ConversationSummary, "contactName" | "phone">): string {
  return conversation.contactName?.trim() || formatPhone(conversation.phone).text;
}

function ActivePills({
  filters,
  connections,
  labels,
  onChange
}: {
  readonly filters: InboxFilters;
  readonly connections: ReadonlyArray<ConnectionSummary>;
  readonly labels: ReadonlyArray<LabelSummary>;
  readonly onChange: (next: Partial<InboxFilters>) => void;
}) {
  const pills: Array<{ key: string; text: string; color?: string; remove: () => void }> = [];
  const connection = connections.find((item) => item.id === filters.connectionId);
  if (filters.connectionId) pills.push({ key: "connection", text: connection?.name ?? "Número", remove: () => onChange({ connectionId: "" }) });
  for (const id of filters.labelIds) {
    const label = labels.find((item) => item.id === id);
    pills.push({
      key: `label-${id}`,
      text: label?.name ?? "Etiqueta",
      ...(label ? { color: label.color } : {}),
      remove: () => onChange({ labelIds: filters.labelIds.filter((labelId) => labelId !== id) })
    });
  }
  if (filters.date.preset !== "any") pills.push({ key: "date", text: dateLabel(filters.date), remove: () => onChange({ date: { preset: "any" } }) });
  if (pills.length === 0) return null;
  return (
    <ul className="ios-pills" aria-label="Filtros aplicados">
      {pills.map((pill) => (
        <li key={pill.key} className="ios-pill" style={pill.color ? { ["--label-color" as string]: pill.color } : undefined}>
          {pill.color ? <span className="ios-label__dot" aria-hidden="true" /> : null}
          {pill.text}
          <button type="button" aria-label={`Quitar filtro ${pill.text}`} onClick={pill.remove}>
            <CloseGlyph />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ConversationList({
  conversations,
  connections,
  labels,
  labelsStatus,
  selectedId,
  filters,
  filtering,
  hasMore,
  loadingMore,
  onFilters,
  onClearFilters,
  onLoadMore,
  onSelect
}: {
  readonly conversations: ReadonlyArray<ConversationSummary>;
  readonly connections: ReadonlyArray<ConnectionSummary>;
  readonly labels: ReadonlyArray<LabelSummary>;
  readonly labelsStatus: "loading" | "ready" | "error";
  readonly selectedId: string | null;
  readonly filters: InboxFilters;
  readonly filtering: boolean;
  readonly hasMore: boolean;
  readonly loadingMore: boolean;
  readonly onFilters: (next: Partial<InboxFilters>) => void;
  readonly onClearFilters: () => void;
  readonly onLoadMore: () => void;
  readonly onSelect: (id: string) => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const panelId = useId();
  const count = panelFilterCount(filters);
  const filtered = isFiltered(filters);

  return (
    <section className="ios-list" aria-label="Chats" aria-busy={filtering || undefined}>
      <header className="ios-list__header">
        <div className="ios-list__titlebar">
          <h1 className="ios-list__title">Conversaciones</h1>
          <button
            type="button"
            className={`ios-filter-btn${count ? " is-active" : ""}`}
            aria-expanded={panelOpen}
            aria-controls={panelId}
            onClick={() => setPanelOpen((open) => !open)}
          >
            <FilterGlyph />
            Filtros
            {count ? <span className="ios-filter-btn__count" aria-label={`${count} aplicados`}>{count}</span> : null}
          </button>
        </div>
        <label className="ios-search">
          <SearchGlyph />
          <input
            type="search"
            value={filters.search}
            placeholder="Buscar por nombre o número"
            aria-label="Buscar chats"
            onChange={(event) => onFilters({ search: event.target.value })}
          />
        </label>
        <div className="ios-filters" role="tablist" aria-label="Estado del chat">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={filters.status === option.value}
              className="ios-chip"
              onClick={() => onFilters({ status: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div id={panelId} hidden={!panelOpen}>
          {panelOpen ? (
            <InboxFiltersPanel
              filters={filters}
              connections={connections}
              labels={labels}
              labelsStatus={labelsStatus}
              onChange={onFilters}
              onClear={() => {
                onClearFilters();
                setPanelOpen(false);
              }}
            />
          ) : null}
        </div>
        <ActivePills filters={filters} connections={connections} labels={labels} onChange={onFilters} />
      </header>

      {conversations.length === 0 ? (
        <div className="ios-list__empty">
          <ChatsGlyph />
          <strong>{filtered ? "Sin resultados" : "Aún no hay chats"}</strong>
          <span>{filtered ? "Ningún chat coincide con estos filtros." : "Cuando un cliente escriba a uno de tus números, su chat aparece aquí."}</span>
          {filtered ? (
            <button type="button" className="ios-link-btn" onClick={onClearFilters}>
              Limpiar filtros
            </button>
          ) : null}
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
                    {conversation.labels.length || connections.length > 1 || conversation.connectionDeleted ? (
                      <span className="ios-row__extra">
                        <ChatLabels labels={conversation.labels} />
                        {conversation.connectionDeleted ? (
                          <span className="ios-row__connection is-deleted">{conversation.connectionName} · eliminado</span>
                        ) : connections.length > 1 ? (
                          <span className="ios-row__connection">{conversation.connectionName}</span>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
          {hasMore ? (
            <li className="ios-list__more">
              <button type="button" className="ios-link-btn" disabled={loadingMore} onClick={onLoadMore}>
                {loadingMore ? "Cargando…" : "Ver más chats"}
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}
