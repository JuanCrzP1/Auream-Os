import { useId } from "react";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import type { LabelSummary } from "@contracts/ContactContracts";
import { DATE_OPTIONS, invalidCustomRange, type DateChoice, type InboxFilters } from "../model/inboxFilters";
import { CheckGlyph } from "./ChatGlyphs";

// ---------------------------------------------------------------------------
// Panel «Filtros» de la bandeja: número de WhatsApp, etiquetas del cliente
// (cualquiera de las elegidas) y fecha del último mensaje. Cada cambio se
// aplica al momento; «Limpiar» los quita todos.
// ---------------------------------------------------------------------------

export function InboxFiltersPanel({
  filters,
  connections,
  labels,
  labelsStatus,
  onChange,
  onClear
}: {
  readonly filters: InboxFilters;
  readonly connections: ReadonlyArray<ConnectionSummary>;
  readonly labels: ReadonlyArray<LabelSummary>;
  readonly labelsStatus: "loading" | "ready" | "error";
  readonly onChange: (next: Partial<InboxFilters>) => void;
  readonly onClear: () => void;
}) {
  const fromId = useId();
  const toId = useId();
  const setDate = (date: DateChoice) => onChange({ date });
  const toggleLabel = (id: string) =>
    onChange({ labelIds: filters.labelIds.includes(id) ? filters.labelIds.filter((labelId) => labelId !== id) : [...filters.labelIds, id] });

  return (
    <div className="ios-filter-panel" role="group" aria-label="Filtros de la bandeja">
      {connections.length > 1 ? (
        <section className="ios-filter-panel__section">
          <h3>Número de WhatsApp</h3>
          <div className="ios-filter-panel__options">
            <button type="button" className="ios-choice" aria-pressed={filters.connectionId === ""} onClick={() => onChange({ connectionId: "" })}>
              Todos
            </button>
            {connections.map((connection) => (
              <button
                key={connection.id}
                type="button"
                className="ios-choice"
                aria-pressed={filters.connectionId === connection.id}
                onClick={() => onChange({ connectionId: connection.id })}
              >
                {connection.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="ios-filter-panel__section">
        <h3>Etiquetas</h3>
        {labelsStatus === "loading" ? <p className="ios-filter-panel__hint">Cargando etiquetas…</p> : null}
        {labelsStatus === "error" ? <p className="ios-filter-panel__hint">No se pudieron cargar las etiquetas.</p> : null}
        {labelsStatus === "ready" && labels.length === 0 ? (
          <p className="ios-filter-panel__hint">Aún no tienes etiquetas. Créalas en Contactos o desde la info de un chat.</p>
        ) : null}
        {labels.length ? (
          <div className="ios-filter-panel__options">
            {labels.map((label) => {
              const on = filters.labelIds.includes(label.id);
              return (
                <button
                  key={label.id}
                  type="button"
                  className="ios-choice ios-choice--label"
                  style={{ ["--label-color" as string]: label.color }}
                  aria-pressed={on}
                  onClick={() => toggleLabel(label.id)}
                >
                  {on ? <CheckGlyph /> : <span className="ios-label__dot" aria-hidden="true" />}
                  {label.name}
                </button>
              );
            })}
          </div>
        ) : null}
        {filters.labelIds.length > 1 ? <p className="ios-filter-panel__hint">Muestra los chats con cualquiera de las etiquetas elegidas.</p> : null}
      </section>

      <section className="ios-filter-panel__section">
        <h3>Último mensaje</h3>
        <div className="ios-filter-panel__options">
          {DATE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="ios-choice"
              aria-pressed={filters.date.preset === option.value}
              onClick={() => setDate(option.value === "custom" ? { preset: "custom", ...(filters.date.from ? { from: filters.date.from } : {}), ...(filters.date.to ? { to: filters.date.to } : {}) } : { preset: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
        {filters.date.preset === "custom" ? (
          <div className="ios-filter-panel__range">
            <label htmlFor={fromId}>
              Desde
              <input
                id={fromId}
                type="date"
                value={filters.date.from ?? ""}
                max={filters.date.to}
                onChange={(event) => setDate({ ...filters.date, from: event.target.value })}
              />
            </label>
            <label htmlFor={toId}>
              Hasta
              <input id={toId} type="date" value={filters.date.to ?? ""} min={filters.date.from} onChange={(event) => setDate({ ...filters.date, to: event.target.value })} />
            </label>
          </div>
        ) : null}
        {invalidCustomRange(filters.date) ? (
          <p className="ios-filter-panel__hint ios-filter-panel__hint--error" role="alert">
            «Desde» debe ser antes de «Hasta».
          </p>
        ) : null}
      </section>

      <div className="ios-filter-panel__footer">
        <button type="button" className="ios-link-btn" onClick={onClear}>
          Limpiar filtros
        </button>
      </div>
    </div>
  );
}
