import "./products-tab.css";
import type { ProductSummary } from "@contracts/SalesContracts";
import { SalesIcons } from "../salesIcons";
import { PRODUCT_KIND_LABEL, countryLabel, formatMoney } from "../salesFormat";

/**
 * El catálogo: cada producto con su tipo, sus precios por país y cuántas
 * ventas lleva. Los archivados van al final, atenuados. Sin productos, una
 * tarjeta que explica para qué sirven.
 */
export function ProductsTab({
  products,
  canManage,
  onCreate,
  onEdit
}: {
  readonly products: ReadonlyArray<ProductSummary>;
  readonly canManage: boolean;
  readonly onCreate: () => void;
  readonly onEdit: (product: ProductSummary) => void;
}) {
  if (products.length === 0) {
    return (
      <section className="products-empty" aria-labelledby="products-empty-title">
        <span className="products-empty__icon" aria-hidden="true">
          {SalesIcons.box}
        </span>
        <div>
          <h2 id="products-empty-title" className="products-empty__title">
            Crea tu catálogo
          </h2>
          <p className="products-empty__text">
            Cada producto con su precio en cada país donde vendes. Lo eliges en el bloque Registrar venta y así cada venta queda con su producto, su monto y su moneda.
          </p>
        </div>
        {canManage ? (
          <button type="button" className="ui-btn ui-btn--primary" onClick={onCreate}>
            {SalesIcons.plus}
            Nuevo producto
          </button>
        ) : (
          <p className="products-empty__text">Pide a un administrador que cree los productos.</p>
        )}
      </section>
    );
  }

  return (
    <ul className="products-grid" aria-label="Productos">
      {products.map((product) => (
        <li key={product.id}>
          <button
            type="button"
            className={`product-card${product.status === "archived" ? " product-card--archived" : ""}`}
            onClick={() => onEdit(product)}
            disabled={!canManage}
            aria-label={canManage ? `Editar ${product.name}` : product.name}
          >
            <span className="product-card__head">
              <span className="product-card__name">{product.name}</span>
              <span className={`product-card__kind product-card__kind--${product.kind}`}>{PRODUCT_KIND_LABEL[product.kind]}</span>
            </span>
            {product.description ? <span className="product-card__description">{product.description}</span> : null}
            <span className="product-card__prices">
              {product.prices.map((price) => (
                <span key={price.country} className="product-card__price">
                  {countryLabel(price.country)} · {formatMoney(price.amount, price.currency)}
                </span>
              ))}
            </span>
            <span className="product-card__foot">
              {product.status === "archived" ? "Archivado · " : ""}
              {product.salesCount === 1 ? "1 venta" : `${product.salesCount} ventas`}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
