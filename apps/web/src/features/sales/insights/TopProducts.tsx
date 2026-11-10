import "./top-products.css";
import type { TopProduct } from "@contracts/SalesInsightsContracts";
import { PRODUCT_KIND_LABEL } from "../salesFormat";

/** Los productos que más se vendieron en el periodo, con su parte de las ventas. */
export function TopProducts({ products }: { readonly products: ReadonlyArray<TopProduct> }) {
  return (
    <aside className="top-products" aria-labelledby="top-products-title">
      <h2 id="top-products-title" className="top-products__title">
        Lo que más vende
      </h2>
      {products.length === 0 ? (
        <p className="top-products__empty">Cuando registres ventas con producto, aquí verás cuáles se llevan la mayor parte.</p>
      ) : (
        <ol className="top-products__list">
          {products.map((product, index) => (
            <li key={product.productId} className="top-products__item">
              <span className="top-products__row">
                <span className="top-products__name">
                  {product.name}
                  {product.kind && product.kind !== "main" ? <span className={`top-products__kind top-products__kind--${product.kind}`}> · {PRODUCT_KIND_LABEL[product.kind].toLowerCase()}</span> : null}
                </span>
                <span className="top-products__share">{product.share} %</span>
              </span>
              <span className="top-products__track" aria-hidden="true">
                <span className={`top-products__bar top-products__bar--${index}`} style={{ width: `${Math.max(product.share, 3)}%` }} />
              </span>
              <span className="top-products__count">{product.count === 1 ? "1 venta" : `${product.count} ventas`}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="top-products__note">
        <strong>Con Meta Ads conectado:</strong> aquí verás también qué anuncio trajo más ventas y cuánto te devolvió cada peso invertido.
      </p>
    </aside>
  );
}
