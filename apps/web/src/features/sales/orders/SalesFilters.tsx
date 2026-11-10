import "./sales-filters.css";
import type { ProductSummary } from "@contracts/SalesContracts";
import { SalesIcons } from "../salesIcons";

export interface SalesFilterValue {
  readonly productId: string;
  readonly search: string;
}

/** Búsqueda (cliente, teléfono, referencia o anuncio) y producto, en la cabecera de la tabla. */
export function SalesFilters({
  value,
  products,
  onChange
}: {
  readonly value: SalesFilterValue;
  readonly products: ReadonlyArray<ProductSummary>;
  readonly onChange: (next: SalesFilterValue) => void;
}) {
  return (
    <div className="sales-filters">
      <label className="sales-filters__search">
        <span className="sales-filters__icon">{SalesIcons.search}</span>
        <input
          type="search"
          aria-label="Buscar venta"
          placeholder="Cliente, teléfono, referencia o anuncio…"
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
        />
      </label>
      <select className="sales-filters__select" aria-label="Producto" value={value.productId} onChange={(event) => onChange({ ...value, productId: event.target.value })}>
        <option value="">Todos los productos</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name}
          </option>
        ))}
      </select>
    </div>
  );
}
