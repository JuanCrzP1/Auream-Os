import "@shared/ui/controls/controls.css";
import "./sale-dialog.css";
import { useId, useState, type FormEvent } from "react";
import type { ProductSummary, RecordSaleRequest, SaleSummary } from "@contracts/SalesContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { countryOfPhone, formatPhone } from "@shared/phone/formatPhone";
import { SaleFields, type SaleFormValue } from "./SaleFields";

const EMPTY: SaleFormValue = { productId: "", country: "", amount: "", currency: "", customerName: "" };

/** El chat desde el que se anota: el servidor toma de ahí el cliente, el número y el anuncio. */
export interface SaleChat {
  readonly conversationId: string;
  readonly customerName: string | null;
  /** Solo dígitos, con indicativo. */
  readonly phone: string;
  readonly connectionName: string;
}

/**
 * Anotar una venta cerrada por chat. Completa queda aprobada; si falta el
 * producto, el monto o la moneda, queda «Por revisar» para que un
 * administrador la complete. Desde un chat (`chat`) no se pide el teléfono:
 * la venta queda con ese cliente y cuenta para el anuncio por el que llegó.
 */
export function RecordSaleDialog({
  products,
  chat,
  onRecord,
  onClose
}: {
  readonly products: ReadonlyArray<ProductSummary>;
  readonly chat?: SaleChat;
  readonly onRecord: (request: RecordSaleRequest) => Promise<SaleSummary>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const phoneId = useId();
  const noteId = useId();
  const [value, setValue] = useState<SaleFormValue>(() => (chat ? { ...EMPTY, customerName: chat.customerName ?? "", country: countryOfPhone(chat.phone)?.code ?? "" } : EMPTY));
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
        ...(chat ? { conversationId: chat.conversationId } : { customerPhone: phone || null }),
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
            <h2 id={titleId}>{chat ? "Registrar venta" : "Anotar venta"}</h2>
            <p className="ui-muted">
              {chat
                ? "Queda con este cliente y, si llegó por un anuncio, cuenta para el ROAS real de ese anuncio."
                : "Una venta que cerraste por chat. Si falta el producto o el monto, queda «Por revisar» y no suma hasta completarla."}
            </p>
          </div>
          {chat ? (
            <div className="sale-dialog__chat" aria-label="Cliente del chat">
              <strong>{chat.customerName ?? formatPhone(chat.phone).text}</strong>
              <span>{formatPhone(chat.phone).text} · escribe a {chat.connectionName}</span>
            </div>
          ) : null}
          <SaleFields idPrefix="record-sale" value={value} products={products} onChange={setValue} />
          <div className="sale-fields">
            {chat ? null : (
              <div className="ui-field">
                <label htmlFor={phoneId}>WhatsApp del cliente</label>
                <input id={phoneId} className="ui-input" inputMode="tel" placeholder="+57 300 123 4567" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </div>
            )}
            <div className={chat ? "ui-field sale-fields__wide" : "ui-field"}>
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
              {busy ? "Guardando…" : chat ? "Registrar venta" : "Anotar venta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
