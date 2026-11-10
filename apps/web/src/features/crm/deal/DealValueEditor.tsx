import { useState } from "react";
import { CURRENCY_CODES } from "@contracts/Countries";
import type { ContactDeal } from "@contracts/CrmActivityContracts";
import type { ProductSummary } from "@contracts/SalesContracts";
import { formatMoney } from "@shared/format/formatMoney";

/**
 * El valor del cliente: el precio de un producto (en su país) o un monto a
 * mano en su moneda. Nunca se inventa: sin valor dice «Sin valor».
 */
export function DealValueEditor({
  deal,
  products,
  canWrite,
  onSave
}: {
  readonly deal: ContactDeal;
  readonly products: ReadonlyArray<ProductSummary>;
  readonly canWrite: boolean;
  readonly onSave: (change: { amount?: string | null; currency?: string | null; productId?: string | null }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(deal.value ? String(deal.value.amount) : "");
  const [currency, setCurrency] = useState(deal.value?.currency ?? "COP");
  const active = products.filter((product) => product.status === "active");

  if (!editing) {
    return (
      <div className="deal-stage__card">
        <span className="deal-stage__label">Valor</span>
        <span className="deal-stage__value">{deal.value ? formatMoney(deal.value.amount, deal.value.currency) : "Sin valor"}</span>
        <span className="deal-stage__hint">
          {deal.productName ?? "Sin producto"}
          {canWrite ? <> · <button type="button" className="ui-link deal-stage__change" onClick={() => setEditing(true)}>cambiar</button></> : null}
        </span>
      </div>
    );
  }
  return (
    <form
      className="deal-stage__card deal-stage__card--editing"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(amount.trim() ? { amount: amount.trim(), currency } : { amount: null }).then(() => setEditing(false));
      }}
    >
      <span className="deal-stage__label">Valor</span>
      <select className="ui-input" aria-label="Producto" value={deal.productId ?? ""} onChange={(event) => void onSave({ productId: event.target.value || null }).then(() => setEditing(false))}>
        <option value="">Sin producto</option>
        {active.map((product) => <option key={product.id} value={product.id}>{product.name} (su precio en el país)</option>)}
      </select>
      <span className="deal-stage__row">
        <input className="ui-input" aria-label="Monto" inputMode="decimal" placeholder="49.900" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <select className="ui-input" aria-label="Moneda" value={currency} onChange={(event) => setCurrency(event.target.value)}>
          {CURRENCY_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
        </select>
      </span>
      <span className="deal-stage__row">
        <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setEditing(false)}>Cancelar</button>
        <button type="submit" className="ui-btn ui-btn--primary">Guardar</button>
      </span>
    </form>
  );
}
