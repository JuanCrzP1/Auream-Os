import "@shared/ui/controls/controls.css";
import "./sale-dialog.css";
import { useId, useState, type FormEvent } from "react";
import type { ProductSummary, RecordSaleRequest, SaleSummary } from "@contracts/SalesContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { SaleFields, type SaleFormValue } from "./SaleFields";

const EMPTY: SaleFormValue = { productId: "", country: "", amount: "", currency: "", customerName: "" };

/**
 * Anotar una venta cerrada por chat (el asesor). Completa queda aprobada; si
 * falta el producto, el monto o la moneda, queda «Por revisar» para que un
 * administrador la complete.
 */
export function RecordSaleDialog({
  products,
  onRecord,
  onClose
}: {
  readonly products: ReadonlyArray<ProductSummary>;
  readonly onRecord: (request: RecordSaleRequest) => Promise<SaleSummary>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const phoneId = useId();
  const noteId = useId();
  const [value, setValue] = useState<SaleFormValue>(EMPTY);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onRecord({
        productId: value.productId || null,
        amount: value.amount.trim() || null,
        currency: value.currency || null,
        country: value.country || null,
        customerName: value.customerName || null,
        customerPhone: phone || null,
        note
      });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo anotar la venta."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog sale-dialog" onClick={(event) => event.stopPropagation()}>
        <form className="sale-dialog__form" onSubmit={(event) => void submit(event)}>
          <div>
            <h2 id={titleId}>Anotar venta</h2>
            <p className="ui-muted">Una venta que cerraste por chat. Si falta el producto o el monto, queda «Por revisar» y no suma hasta completarla.</p>
          </div>
          <SaleFields idPrefix="record-sale" value={value} products={products} onChange={setValue} />
          <div className="sale-fields">
            <div className="ui-field">
              <label htmlFor={phoneId}>WhatsApp del cliente</label>
              <input id={phoneId} className="ui-input" inputMode="tel" placeholder="+57 300 123 4567" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor={noteId}>Nota</label>
              <input id={noteId} className="ui-input" maxLength={500} placeholder="Opcional" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
          </div>
          {error ? (
            <p className="ui-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="ui-dialog__footer">
            <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" className="ui-btn ui-btn--primary" disabled={busy}>
              {busy ? "Guardando…" : "Anotar venta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
