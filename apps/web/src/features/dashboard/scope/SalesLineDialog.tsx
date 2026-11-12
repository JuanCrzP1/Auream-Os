import "./sales-line-dialog.css";
import { useId, useState } from "react";
import { SALES_LINE_COLORS, type SalesLineSummary, type SaveSalesLineRequest } from "@contracts/SalesLineContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { CheckList } from "./CheckList";
import type { FilterOptions } from "./FiltersPanel";
import { lineSentence } from "./lineSentence";

const toggle = (list: ReadonlyArray<string>, id: string) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
const namesOf = (items: FilterOptions["productIds"], ids: ReadonlyArray<string>) => items.filter((item) => ids.includes(item.id)).map((item) => item.label);

/**
 * Crear o editar una línea de venta: nombre, color, qué productos vende, por
 * qué números (vacío = todos) y qué campañas la promocionan. Abajo, en una
 * frase, lo que va a medir. Al editar, también se puede borrar.
 */
export function SalesLineDialog({ line, options, onSave, onDelete, onClose }: {
  readonly line: SalesLineSummary | null;
  readonly options: FilterOptions;
  readonly onSave: (request: SaveSalesLineRequest) => Promise<unknown>;
  readonly onDelete: (() => Promise<unknown>) | null;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [name, setName] = useState(line?.name ?? "");
  const [color, setColor] = useState(line?.color ?? SALES_LINE_COLORS[1]);
  const [productIds, setProductIds] = useState<ReadonlyArray<string>>(line?.productIds ?? []);
  const [connectionIds, setConnectionIds] = useState<ReadonlyArray<string>>(line?.connectionIds ?? []);
  const [campaignIds, setCampaignIds] = useState<ReadonlyArray<string>>(line?.campaignIds ?? []);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = name.trim().length > 0 && (productIds.length > 0 || campaignIds.length > 0);

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, fallback));
      setBusy(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void run(() => onSave({ name: name.trim(), color, productIds, connectionIds, campaignIds }), "No se pudo guardar la línea. Inténtalo de nuevo.");
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <form className="ui-dialog sales-line-dialog" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <h2 id={titleId}>{line ? "Editar línea de venta" : "Crear línea de venta"}</h2>
        <p className="ui-muted">Una parte de tu negocio que quieres medir aparte: un país, un producto o un tipo de cliente.</p>
        <label className="ui-field">
          <span>Nombre</span>
          <input className="ui-input" value={name} maxLength={40} placeholder="Ej.: Venezuela" autoFocus onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="ui-field">
          <span>Color</span>
          <div className="sales-line-dialog__colors" role="radiogroup" aria-label="Color">
            {SALES_LINE_COLORS.map((option) => (
              <button key={option} type="button" role="radio" aria-checked={color === option} aria-label={`Color ${option}`} style={{ background: option }} onClick={() => setColor(option)} />
            ))}
          </div>
        </div>
        <div className="sales-line-dialog__box">
          <CheckList title="¿Qué productos vende?" note="sus ventas cuentan en la línea" items={options.productIds} selected={productIds} onToggle={(id) => setProductIds(toggle(productIds, id))} allWhenEmpty={false} searchable empty="Aún no tienes productos en Ventas › Productos." />
        </div>
        <div className="sales-line-dialog__box">
          <CheckList title="¿Por qué números?" note="opcional: ninguno = todos" items={options.connectionIds} selected={connectionIds} onToggle={(id) => setConnectionIds(toggle(connectionIds, id))} allWhenEmpty={false} empty="Aún no tienes números conectados." />
        </div>
        {options.campaignIds ? (
          <div className="sales-line-dialog__box">
            <CheckList title="¿Qué campañas la promocionan?" note="su gasto es el de la línea" items={options.campaignIds} selected={campaignIds} onToggle={(id) => setCampaignIds(toggle(campaignIds, id))} allWhenEmpty={false} searchable empty="Sin campañas con gasto en este periodo." />
          </div>
        ) : null}
        <p className="sales-line-dialog__summary">
          {ready
            ? `✓ ${lineSentence({ name, products: namesOf(options.productIds, productIds), numbers: namesOf(options.connectionIds, connectionIds), campaigns: namesOf(options.campaignIds ?? [], campaignIds) })}`
            : "Ponle un nombre y elige al menos un producto o una campaña."}
        </p>
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          {onDelete ? (
            <button type="button" className="ui-btn ui-btn--ghost sales-line-dialog__delete" disabled={busy} onClick={() => (confirmDelete ? void run(onDelete, "No se pudo borrar la línea.") : setConfirmDelete(true))}>
              {confirmDelete ? "¿Seguro? Borrar línea" : "Borrar línea"}
            </button>
          ) : null}
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={busy || !ready}>{busy ? "Guardando…" : "Guardar línea"}</button>
        </div>
      </form>
    </div>
  );
}
