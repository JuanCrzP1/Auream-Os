import "../_kit/kit.css";
import type { ToolCompactProps } from "../ToolUi";
import { readRecordSaleConfig } from "./recordSaleConfig";

/** Nodo cerrado: el producto como insignia y de dónde sale el monto. */
export function RecordSaleCompactBody({ draft }: ToolCompactProps) {
  const read = readRecordSaleConfig(draft.config);

  return (
    <div className="kit-node">
      <span className="kit-node__eyebrow">Ventas</span>
      {read.productId ? (
        <div className="kit-node__row">
          <span className="kit-node__badge">{read.productName || "Producto elegido"}</span>
          <span className="kit-node__meta">{read.amountMode === "product" ? "Precio del país" : read.amount.trim() || "Sin monto"}</span>
        </div>
      ) : (
        <span className="kit-node__meta">Sin producto elegido</span>
      )}
    </div>
  );
}
