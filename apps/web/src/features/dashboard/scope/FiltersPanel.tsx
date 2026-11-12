import "./scope-pop.css";
import { CheckList, type CheckItem } from "./CheckList";
import type { Dimension } from "./dashboardScope";

export interface FilterOptions {
  readonly connectionIds: ReadonlyArray<CheckItem>;
  readonly productIds: ReadonlyArray<CheckItem>;
  /** `null`: quien mira no puede ver los anuncios (no se muestra). */
  readonly campaignIds: ReadonlyArray<CheckItem> | null;
}

/**
 * Filtros: varios números, productos y campañas de Meta a la vez. Lo marcado
 * viene de la línea elegida; cambiarlo aquí manda sobre la línea.
 */
export function FiltersPanel({ options, selected, onToggle, onClear, onDone }: {
  readonly options: FilterOptions;
  readonly selected: Readonly<Record<Dimension, ReadonlyArray<string>>>;
  readonly onToggle: (dimension: Dimension, id: string) => void;
  readonly onClear: () => void;
  readonly onDone: () => void;
}) {
  return (
    <div className="scope-pop scope-pop--wide" role="dialog" aria-label="Filtros">
      <CheckList title="Números" items={options.connectionIds} selected={selected.connectionIds} onToggle={(id) => onToggle("connectionIds", id)} empty="Aún no tienes números conectados." />
      <CheckList title="Productos" items={options.productIds} selected={selected.productIds} onToggle={(id) => onToggle("productIds", id)} searchable empty="Aún no tienes productos en Ventas › Productos." />
      {options.campaignIds ? (
        <CheckList title="Campañas de Meta" items={options.campaignIds} selected={selected.campaignIds} onToggle={(id) => onToggle("campaignIds", id)} searchable empty="Sin campañas con gasto en este periodo." />
      ) : null}
      <div className="scope-pop__hr" />
      <div className="scope-pop__footer">
        <button type="button" className="scope-pop__link" onClick={onClear}>Limpiar filtros</button>
        <button type="button" className="scope-pop__link scope-pop__link--primary" onClick={onDone}>Listo</button>
      </div>
    </div>
  );
}
