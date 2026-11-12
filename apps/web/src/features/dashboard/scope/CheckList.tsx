import "./scope-pop.css";
import { useState } from "react";

export interface CheckItem {
  readonly id: string;
  readonly label: string;
  /** Al lado, en gris: un teléfono o lo gastado. */
  readonly hint?: string;
}

/**
 * Una lista con casillas para elegir varios (Números, Productos, Campañas).
 * `selected` vacío = todos marcados. Con `searchable`, un buscador arriba.
 */
export function CheckList({ title, items, selected, onToggle, searchable = false, empty, allWhenEmpty = true, note }: {
  readonly title: string;
  readonly items: ReadonlyArray<CheckItem>;
  readonly selected: ReadonlyArray<string>;
  readonly onToggle: (id: string) => void;
  readonly searchable?: boolean;
  readonly empty: string;
  /** En los filtros, nada elegido = todos marcados; en el formulario de una línea, nada es nada. */
  readonly allWhenEmpty?: boolean;
  /** Al lado del título, en gris. */
  readonly note?: string;
}) {
  const [query, setQuery] = useState("");
  const text = query.trim().toLowerCase();
  const shown = text ? items.filter((item) => item.label.toLowerCase().includes(text)) : items;
  return (
    <section className="scope-pop__section" aria-label={title}>
      <h4>
        {title}
        {note ? <span className="scope-pop__hint"> · {note}</span> : null}
      </h4>
      {searchable && items.length > 5 ? (
        <input className="scope-pop__search" type="search" value={query} placeholder={`Buscar en ${title.toLowerCase()}…`} aria-label={`Buscar en ${title.toLowerCase()}`} onChange={(event) => setQuery(event.target.value)} />
      ) : null}
      {items.length === 0 ? <p className="scope-pop__empty">{empty}</p> : null}
      {shown.map((item) => (
        <label key={item.id} className="scope-check">
          <input type="checkbox" checked={(allWhenEmpty && selected.length === 0) || selected.includes(item.id)} onChange={() => onToggle(item.id)} />
          <span className="scope-check__label">{item.label}</span>
          {item.hint ? <small>{item.hint}</small> : null}
        </label>
      ))}
    </section>
  );
}
