import "./scope-bar.css";
import { useState } from "react";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import type { ProductSummary } from "@contracts/SalesContracts";
import type { SalesLineSummary } from "@contracts/SalesLineContracts";
import { useSalesLines } from "@shared/sales-lines/useSalesLines";
import { CurrencyMenu } from "./CurrencyMenu";
import { currencyOption } from "./currencyOptions";
import { activeFilters, chooseLine, DIMENSIONS, effectiveIds, toggleId, type Dimension, type ScopeSelection } from "./dashboardScope";
import { FiltersPanel, type FilterOptions } from "./FiltersPanel";
import { LineMenu } from "./LineMenu";
import { SalesLineDialog } from "./SalesLineDialog";
import { useCampaignOptions } from "./useCampaignOptions";
import { usePopover } from "./usePopover";

/**
 * A la derecha de las pestañas del Dashboard: la línea de venta, los filtros
 * (varios números, productos y campañas) y la moneda. Cada botón abre su panel
 * encima; lo elegido viaja en la dirección (`selection` / `onChange`).
 */
export function ScopeBar({ selection, onChange, connections, products, canSeeAds, range, automaticCurrency }: {
  readonly selection: ScopeSelection;
  readonly onChange: (next: ScopeSelection) => void;
  readonly connections: ReadonlyArray<ConnectionSummary>;
  readonly products: ReadonlyArray<ProductSummary>;
  readonly canSeeAds: boolean;
  readonly range: { readonly from: string; readonly to: string };
  /** La moneda que se usa sin elegir ninguna (la del último informe). */
  readonly automaticCurrency: string;
}) {
  const { open, setOpen, toggle, ref } = usePopover<"line" | "filters" | "currency">();
  const lines = useSalesLines();
  const campaigns = useCampaignOptions(range, canSeeAds);
  const [editing, setEditing] = useState<SalesLineSummary | "new" | null>(null);
  const line = lines.lines.find((item) => item.id === selection.lineId);
  const options: FilterOptions = {
    connectionIds: connections.map((connection) => ({ id: connection.id, label: connection.name, ...(connection.phoneNumber ? { hint: `+${connection.phoneNumber}` } : {}) })),
    productIds: products.filter((product) => product.status === "active").map((product) => ({ id: product.id, label: product.name })),
    campaignIds: campaigns
  };
  const selected = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, effectiveIds(selection, line, dimension)])) as Record<Dimension, ReadonlyArray<string>>;
  const count = activeFilters(selection, line);
  const currency = currencyOption(selection.currency ?? automaticCurrency);

  const onToggle = (dimension: Dimension, id: string) => {
    const all = (options[dimension] ?? []).map((item) => item.id);
    onChange({ ...selection, [dimension]: toggleId(selected[dimension], id, all) });
  };

  return (
    <div className="scope-bar" ref={ref}>
      <div className="scope-bar__wrap">
        <button type="button" className="scope-bar__btn scope-bar__btn--line" aria-haspopup="menu" aria-expanded={open === "line"} onClick={() => toggle("line")}>
          <span className="scope-bar__dot" style={{ background: line?.color ?? "#6c4fe0" }} aria-hidden="true" />
          Línea <strong>{line?.name ?? "Todo el negocio"}</strong>
          {line ? null : <span className="scope-bar__caret" aria-hidden="true">▾</span>}
        </button>
        {line ? (
          <button type="button" className="scope-bar__clear" aria-label="Ver todo el negocio" title="Ver todo el negocio" onClick={() => onChange(chooseLine(selection, null))}>×</button>
        ) : null}
        {open === "line" ? (
          <LineMenu
            lines={lines.lines}
            selectedId={line?.id ?? null}
            canManage={lines.canManage}
            onChoose={(lineId) => { onChange(chooseLine(selection, lineId)); setOpen(null); }}
            onCreate={() => { setEditing("new"); setOpen(null); }}
            onEdit={(item) => { setEditing(item); setOpen(null); }}
          />
        ) : null}
      </div>

      <div className="scope-bar__wrap">
        <button type="button" className="scope-bar__btn" aria-haspopup="dialog" aria-expanded={open === "filters"} onClick={() => toggle("filters")}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          <strong>Filtros</strong>
          {count ? <span className="scope-bar__badge" aria-label={`${count} filtros activos`}>{count}</span> : <span className="scope-bar__caret" aria-hidden="true">▾</span>}
        </button>
        {open === "filters" ? (
          <FiltersPanel options={options} selected={selected} onToggle={onToggle} onClear={() => { onChange(chooseLine(selection, null)); setOpen(null); }} onDone={() => setOpen(null)} />
        ) : null}
      </div>

      <div className="scope-bar__wrap">
        <button type="button" className="scope-bar__btn" aria-haspopup="menu" aria-expanded={open === "currency"} title={`${currency.code} · ${currency.name}`} onClick={() => toggle("currency")}>
          <span className="scope-bar__flag" aria-hidden="true">{currency.flag}</span>
          <strong>{currency.code}</strong>
          <span className="scope-bar__caret" aria-hidden="true">▾</span>
        </button>
        {open === "currency" ? (
          <CurrencyMenu current={currency.code} automatic={automaticCurrency} onChoose={(code) => { onChange({ ...selection, currency: code }); setOpen(null); }} />
        ) : null}
      </div>

      {editing ? (
        <SalesLineDialog
          line={editing === "new" ? null : editing}
          options={options}
          onSave={async (request) => {
            const saved = await lines.save(request, editing === "new" ? undefined : editing.id);
            onChange(chooseLine(selection, saved.id));
          }}
          onDelete={editing === "new" ? null : async () => {
            await lines.remove(editing.id);
            if (selection.lineId === editing.id) onChange(chooseLine(selection, null));
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
