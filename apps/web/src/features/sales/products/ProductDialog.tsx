import "@shared/ui/controls/controls.css";
import "./product-dialog.css";
import { useId, useState, type FormEvent } from "react";
import { PRODUCT_KINDS, type ProductKind, type ProductSummary, type SaveProductRequest } from "@contracts/SalesContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { PRODUCT_KIND_HINT, PRODUCT_KIND_LABEL } from "../salesFormat";
import { PriceRows, newPriceRow, type PriceDraft } from "./PriceRows";

/**
 * Crear o editar un producto: nombre, tipo (principal, upsell o downsell),
 * descripción y su precio en cada país. Uno existente se puede archivar (deja
 * de ofrecerse; sus ventas se conservan) o volver a activar.
 */
export function ProductDialog({
  product,
  onSave,
  onClose
}: {
  readonly product: ProductSummary | null;
  readonly onSave: (request: SaveProductRequest) => Promise<unknown>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const nameId = useId();
  const descriptionId = useId();
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [kind, setKind] = useState<ProductKind>(product?.kind ?? "main");
  const [prices, setPrices] = useState<ReadonlyArray<PriceDraft>>(
    product ? product.prices.map((price) => ({ ...newPriceRow(price.country), currency: price.currency, amount: String(price.amount), cost: price.cost === null || price.cost === undefined ? "" : String(price.cost) })) : [newPriceRow()]
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (status = product?.status ?? "active") => {
    setBusy(true);
    setError(null);
    try {
      await onSave({ name, description, kind, status, prices: prices.map(({ country, currency, amount, cost }) => ({ country, currency, amount, cost: cost.trim() || null })) });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar el producto."));
      setBusy(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save();
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog product-dialog" onClick={(event) => event.stopPropagation()}>
        <form className="product-dialog__form" onSubmit={submit}>
          <div>
            <h2 id={titleId}>{product ? "Editar producto" : "Nuevo producto"}</h2>
            <p className="ui-muted">Lo eliges en el bloque Registrar venta y al anotar una venta. El precio en cada país se propone solo.</p>
          </div>
          <div className="ui-field">
            <label htmlFor={nameId}>Nombre</label>
            <input id={nameId} className="ui-input" maxLength={80} placeholder="Video personalizado" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </div>
          <fieldset className="product-dialog__kinds">
            <legend>Tipo</legend>
            {PRODUCT_KINDS.map((option) => (
              <label key={option} className="product-kind">
                <input type="radio" name="product-kind" value={option} checked={kind === option} onChange={() => setKind(option)} />
                <span className="product-kind__body">
                  <span className="product-kind__title">{PRODUCT_KIND_LABEL[option]}</span>
                  <span className="product-kind__text">{PRODUCT_KIND_HINT[option]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="ui-field">
            <span className="product-dialog__label">Precio por país</span>
            <PriceRows rows={prices} onChange={setPrices} />
          </div>
          <div className="ui-field">
            <label htmlFor={descriptionId}>Descripción</label>
            <textarea id={descriptionId} className="ui-input product-dialog__description" maxLength={500} placeholder="Opcional: qué incluye" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          {error ? (
            <p className="ui-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="ui-dialog__footer">
            {product ? (
              <button type="button" className="ui-btn ui-btn--ghost" disabled={busy} onClick={() => void save(product.status === "active" ? "archived" : "active")}>
                {product.status === "active" ? "Archivar" : "Volver a activar"}
              </button>
            ) : null}
            <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" className="ui-btn ui-btn--primary" disabled={busy || !name.trim()}>
              {busy ? "Guardando…" : product ? "Guardar cambios" : "Crear producto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
