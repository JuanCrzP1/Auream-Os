import "./scope-pop.css";
import type { SalesLineSummary } from "@contracts/SalesLineContracts";

const ALL_COLOR = "#6c4fe0";

function lineDetail(line: SalesLineSummary): string {
  const products = `${line.productIds.length} ${line.productIds.length === 1 ? "producto" : "productos"}`;
  const campaigns = `${line.campaignIds.length} ${line.campaignIds.length === 1 ? "campaña" : "campañas"}`;
  return line.campaignIds.length ? `${products} · ${campaigns}` : products;
}

/**
 * El menú de líneas de venta: «Todo el negocio» y cada línea (con lo que
 * junta). Quien puede organizarlas las crea y las edita desde aquí.
 */
export function LineMenu({ lines, selectedId, canManage, onChoose, onCreate, onEdit }: {
  readonly lines: ReadonlyArray<SalesLineSummary>;
  readonly selectedId: string | null;
  readonly canManage: boolean;
  readonly onChoose: (lineId: string | null) => void;
  readonly onCreate: () => void;
  readonly onEdit: (line: SalesLineSummary) => void;
}) {
  const option = (id: string | null, name: string, color: string, detail: string, line?: SalesLineSummary) => (
    <div key={id ?? "all"} className="scope-option-row">
      <button type="button" role="menuitemradio" aria-checked={selectedId === id} className="scope-option" onClick={() => onChoose(id)}>
        <span className="scope-bar__dot" style={{ background: color }} aria-hidden="true" />
        <span className="scope-option__body">
          {name}
          <small>{detail}</small>
        </span>
        {selectedId === id ? <span className="scope-option__check" aria-hidden="true">✓</span> : null}
      </button>
      {line && canManage ? (
        <button type="button" className="scope-option__edit" aria-label={`Editar la línea ${line.name}`} title="Editar" onClick={() => onEdit(line)}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16z" />
            <path d="m13.5 6.5 4 4" />
          </svg>
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="scope-pop" role="menu" aria-label="Líneas de venta">
      <h4>Líneas de venta</h4>
      {option(null, "Todo el negocio", ALL_COLOR, "Todo lo que vendes")}
      {lines.map((line) => option(line.id, line.name, line.color, lineDetail(line), line))}
      {lines.length === 0 ? <p className="scope-pop__note">Crea una línea para medir aparte un país, un producto o un tipo de cliente.</p> : null}
      {canManage ? (
        <>
          <div className="scope-pop__hr" />
          <button type="button" className="scope-option scope-option--action" onClick={onCreate}>＋ Crear línea</button>
        </>
      ) : null}
    </div>
  );
}
