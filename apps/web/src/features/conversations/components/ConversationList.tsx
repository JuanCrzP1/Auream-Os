import "./list/inbox-list.css";
import { useId, useState } from "react";
import type { ChatAgent, ConversationStatus, ConversationSummary } from "@contracts/ConversationContracts";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import type { LabelSummary } from "@contracts/ContactContracts";
import { isFiltered, panelFilterCount, STATUS_OPTIONS, TAB_OPTIONS, type InboxFilters } from "../model/inboxFilters";
import { ChatsGlyph, FilterGlyph, SearchGlyph } from "./ChatGlyphs";
import { InboxFiltersPanel } from "./InboxFiltersPanel";
import { ActivePills } from "./list/ActivePills";
import { ConversationRow } from "./list/ConversationRow";
import { InboxTabs } from "./list/InboxTabs";

// ---------------------------------------------------------------------------
// La bandeja: buscador, «Chat nuevo» y «Filtros» (número, responsable,
// etiquetas, fecha); las pestañas por atención (Todos · En espera · En
// atención · Con bot · Resueltos) con sus conteos; los filtros rápidos (Mis
// chats · No leídos · Sin responder) y los chats. Por páginas.
// ---------------------------------------------------------------------------

export { displayName } from "./displayName";

/** Qué decir cuando una pestaña está vacía (sin otros filtros). */
const EMPTY_TAB: Readonly<Record<ConversationStatus, { readonly title: string; readonly text: string }>> = {
  waiting: { title: "Nadie espera 🎉", text: "Cuando el bot se pause o un cliente pida un asesor, su chat aparece aquí para que alguien lo tome." },
  attending: { title: "Nadie está atendiendo", text: "Los chats que toma un asesor aparecen aquí hasta que los resuelve." },
  bot: { title: "El bot no atiende chats ahora", text: "Los chats que atiende tu bot aparecen aquí." },
  resolved: { title: "Aún no hay chats resueltos", text: "Al resolver un chat, el bot vuelve a atenderlo y queda aquí." }
};

export function ConversationList({
  conversations,
  counts,
  connections,
  labels,
  labelsStatus,
  agents,
  meId,
  canWrite,
  selectedId,
  filters,
  filtering,
  hasMore,
  loadingMore,
  onFilters,
  onClearFilters,
  onLoadMore,
  onSelect,
  onNewChat
}: {
  readonly conversations: ReadonlyArray<ConversationSummary>;
  readonly counts: Readonly<Record<ConversationStatus, number>> | null;
  readonly connections: ReadonlyArray<ConnectionSummary>;
  readonly labels: ReadonlyArray<LabelSummary>;
  readonly labelsStatus: "loading" | "ready" | "error";
  readonly agents: ReadonlyArray<ChatAgent>;
  readonly meId: string | null;
  /** Quien mira puede escribir (y empezar chats). */
  readonly canWrite: boolean;
  readonly selectedId: string | null;
  readonly filters: InboxFilters;
  readonly filtering: boolean;
  readonly hasMore: boolean;
  readonly loadingMore: boolean;
  readonly onFilters: (next: Partial<InboxFilters>) => void;
  readonly onClearFilters: () => void;
  readonly onLoadMore: () => void;
  readonly onSelect: (id: string) => void;
  readonly onNewChat: () => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const panelId = useId();
  const count = panelFilterCount(filters);
  const filtered = isFiltered(filters);
  const emptyTab = filters.tab === "all" ? null : EMPTY_TAB[filters.tab];
  const tabName = TAB_OPTIONS.find((option) => option.value === filters.tab)?.label ?? "";

  return (
    <section className="ios-list" aria-label="Chats" aria-busy={filtering || undefined}>
      <header className="ios-list__header">
        <div className="ios-list__titlebar">
          <label className="ios-search">
            <SearchGlyph />
            <input type="search" value={filters.search} placeholder="Buscar por nombre o número" aria-label="Buscar chats" onChange={(event) => onFilters({ search: event.target.value })} />
          </label>
          <button type="button" className={`ios-filter-btn${count ? " is-active" : ""}`} aria-expanded={panelOpen} aria-controls={panelId} onClick={() => setPanelOpen((open) => !open)}>
            <FilterGlyph />
            Filtros
            {count ? <span className="ios-filter-btn__count" aria-label={`${count} aplicados`}>{count}</span> : null}
          </button>
          {canWrite ? (
            <button type="button" className="inbox-new" aria-label="Chat nuevo" title="Chat nuevo: escríbele primero a un número" onClick={onNewChat}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          ) : null}
        </div>
        <InboxTabs value={filters.tab} counts={counts} onChange={(tab) => onFilters({ tab })} />
        <div className="ios-filters" role="group" aria-label="Filtros rápidos">
          {STATUS_OPTIONS.map((option) => (
            <button key={option.value} type="button" aria-pressed={filters.status === option.value} className="ios-chip" onClick={() => onFilters({ status: option.value })}>
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
              agents={agents}
              onChange={onFilters}
              onClear={() => {
                onClearFilters();
                setPanelOpen(false);
              }}
            />
          ) : null}
        </div>
        <ActivePills filters={filters} connections={connections} labels={labels} agents={agents} onChange={onFilters} />
      </header>

      {conversations.length === 0 ? (
        <div className="ios-list__empty">
          <ChatsGlyph />
          <strong>{filtered ? "Sin resultados" : emptyTab ? emptyTab.title : "Aún no hay chats"}</strong>
          <span>
            {filtered
              ? `Ningún chat${emptyTab ? ` en «${tabName}»` : ""} coincide con estos filtros.`
              : emptyTab
                ? emptyTab.text
                : "Cuando un cliente escriba a uno de tus números, su chat aparece aquí."}
          </span>
          {filtered ? (
            <button type="button" className="ios-link-btn" onClick={onClearFilters}>
              Limpiar filtros
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="ios-list__items">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <ConversationRow
                conversation={conversation}
                selected={conversation.id === selectedId}
                meId={meId}
                showConnection={connections.length > 1}
                onSelect={() => onSelect(conversation.id)}
              />
            </li>
          ))}
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
