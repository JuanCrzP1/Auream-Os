import "./board-toolbar.css";

export type BoardView = "board" | "list";
export type OwnerFilter = "" | "me" | "none";

/**
 * Cómo se ve el embudo: Tablero o Lista, de quién (todos, mis clientes, sin
 * responsable) y búsqueda por nombre o teléfono.
 */
export function BoardToolbar({
  view,
  owner,
  search,
  onView,
  onOwner,
  onSearch
}: {
  readonly view: BoardView;
  readonly owner: OwnerFilter;
  readonly search: string;
  readonly onView: (view: BoardView) => void;
  readonly onOwner: (owner: OwnerFilter) => void;
  readonly onSearch: (search: string) => void;
}) {
  const owners: ReadonlyArray<readonly [OwnerFilter, string]> = [["", "Todos"], ["me", "Mis clientes"], ["none", "Sin responsable"]];
  return (
    <div className="board-toolbar">
      <div className="board-toolbar__group" role="group" aria-label="Vista">
        <button type="button" aria-pressed={view === "board"} className="board-toolbar__toggle" onClick={() => onView("board")}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" /></svg>
          Tablero
        </button>
        <button type="button" aria-pressed={view === "list"} className="board-toolbar__toggle" onClick={() => onView("list")}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
          Lista
        </button>
      </div>
      <div className="board-toolbar__group board-toolbar__group--outline" role="group" aria-label="De quién">
        {owners.map(([value, label]) => (
          <button key={label} type="button" aria-pressed={owner === value} className="board-toolbar__toggle" onClick={() => onOwner(value)}>
            {label}
          </button>
        ))}
      </div>
      <label className="board-toolbar__search">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
        <input type="search" value={search} placeholder="Nombre o teléfono…" aria-label="Buscar cliente" onChange={(event) => onSearch(event.target.value)} />
      </label>
    </div>
  );
}
