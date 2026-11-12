import "@shared/ui/controls/controls.css";
import "@shared/sales/sale-dialog.css";
import { useId, useState } from "react";
import type { ProductSummary, SaleSummary, UpdateSaleRequest } from "@contracts/SalesContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { SALE_SOURCE_LABEL, formatSoldAt } from "../salesFormat";
import { SaleFields, type SaleFormValue } from "@shared/sales/SaleFields";
import { SaleStatusChip } from "./SaleStatusChip";

const formOf = (sale: SaleSummary): SaleFormValue => ({
  productId: sale.productId ?? "",
  country: sale.country ?? "",
  amount: sale.amount === null ? "" : String(sale.amount),
  currency: sale.currency ?? "",
  customerName: sale.customerName ?? ""
});

/**
 * Una venta: de dónde vino (flujo, número, comprobante, anuncio) y, para quien
 * puede revisarla, corregirla, aprobarla (solo completa) o anularla con motivo.
 */
export function SaleDialog({
  sale,
  products,
  canManage,
  onUpdate,
  onClose
}: {
  readonly sale: SaleSummary;
  readonly products: ReadonlyArray<ProductSummary>;
  readonly canManage: boolean;
  readonly onUpdate: (id: string, request: UpdateSaleRequest) => Promise<SaleSummary>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const reasonId = useId();
  const [value, setValue] = useState<SaleFormValue>(formOf(sale));
  const [voiding, setVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (status?: UpdateSaleRequest["status"]) => {
    setBusy(true);
    setError(null);
    try {
      await onUpdate(sale.id, {
        productId: value.productId || null,
        amount: value.amount.trim() || null,
        currency: value.currency || null,
        country: value.country || null,
        customerName: value.customerName || null,
        ...(status ? { status } : {}),
        ...(status === "void" ? { voidReason } : {})
      });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar la venta."));
      setBusy(false);
    }
  };

  const facts: ReadonlyArray<readonly [string, string | null]> = [
    ["Fecha", formatSoldAt(sale.soldAt)],
    ["Origen", SALE_SOURCE_LABEL[sale.source]],
    ["Flujo", sale.flowName],
    ["Número", sale.connectionName],
    ["Teléfono", sale.customerPhone ? `+${sale.customerPhone}` : null],
    ["Referencia", sale.receiptReference],
    ["Anuncio", sale.adSourceId],
    ["Anotó o revisó", sale.recordedByName],
    ["Nota", sale.note || null]
  ];

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog sale-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="sale-dialog__form">
          <div>
            <h2 id={titleId}>{sale.status === "review" && canManage ? "Revisar venta" : "Venta"}</h2>
            <SaleStatusChip status={sale.status} />
          </div>
          {sale.reviewReason ? <p className="sale-dialog__reason">{sale.status === "void" ? `Anulada: ${sale.reviewReason}` : sale.reviewReason}</p> : null}
          <dl className="sale-dialog__facts">
            {facts
              .filter((fact): fact is readonly [string, string] => Boolean(fact[1]))
              .map(([label, text]) => (
                <div key={label} className="sale-dialog__fact">
                  <dt>{label}</dt>
                  <dd title={text}>{text}</dd>
                </div>
              ))}
          </dl>

          {canManage ? <SaleFields idPrefix={`sale-${sale.id}`} value={value} products={products} onChange={setValue} /> : null}

          {canManage && voiding ? (
            <div className="sale-dialog__void">
              <label htmlFor={reasonId} className="ui-muted">
                ¿Por qué se anula? Queda guardada, pero deja de sumar.
              </label>
              <input id={reasonId} className="ui-input" maxLength={200} placeholder="Pago falso, devolución, duplicada…" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} />
            </div>
          ) : null}

          {error ? (
            <p className="ui-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="ui-dialog__footer">
            {canManage && sale.status !== "void" && !voiding ? (
              <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setVoiding(true)} disabled={busy}>
                Anular
              </button>
            ) : null}
            <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>
              {canManage ? "Cancelar" : "Cerrar"}
            </button>
            {canManage && voiding ? (
              <button type="button" className="ui-btn ui-btn--danger" onClick={() => void save("void")} disabled={busy || !voidReason.trim()}>
                Anular venta
              </button>
            ) : null}
            {canManage && !voiding && sale.status === "approved" ? (
              <button type="button" className="ui-btn ui-btn--primary" onClick={() => void save()} disabled={busy}>
                {busy ? "Guardando…" : "Guardar cambios"}
              </button>
            ) : null}
            {canManage && !voiding && sale.status !== "approved" ? (
              <button type="button" className="ui-btn ui-btn--primary" onClick={() => void save("approved")} disabled={busy}>
                {busy ? "Guardando…" : "Aprobar venta"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
