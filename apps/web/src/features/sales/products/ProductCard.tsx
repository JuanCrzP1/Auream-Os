import type { ProductSummary } from "@contracts/SalesContracts";
import type { ProductStats } from "@contracts/SalesInsightsContracts";
import { TrendChip } from "../insights/TrendChip";
import { PRODUCT_KIND_LABEL, countryLabel, formatMoney } from "../salesFormat";

const EMPTY_WEEKS = [0, 0, 0, 0, 0, 0, 0, 0];

/** Un producto: su tipo, su precio en cada país y cómo se vende semana a semana (8 semanas). */
export function ProductCard({ product, stats, canManage, onEdit }: { readonly product: ProductSummary; readonly stats: ProductStats | undefined; readonly canManage: boolean; readonly onEdit: () => void }) {
  const weeks = stats?.weekly ?? EMPTY_WEEKS;
  const top = Math.max(...weeks, 1);
  const recent = stats?.recent ?? 0;

  return (
    <button type="button" className={`product-card${product.status === "archived" ? " product-card--archived" : ""}`} onClick={onEdit} disabled={!canManage} aria-label={canManage ? `Editar ${product.name}` : product.name}>
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
      <span className="product-card__weeks" role="img" aria-label={`Ventas de las últimas 8 semanas: ${weeks.join(", ")}`}>
        {weeks.map((count, index) => (
          <span key={index} className={`product-card__week${index === weeks.length - 1 ? " product-card__week--now" : ""}`} style={{ height: `${Math.max((count / top) * 100, 6)}%` }} />
        ))}
      </span>
      <span className="product-card__foot">
        <span>
          {product.status === "archived" ? "Archivado · " : ""}
          {recent === 1 ? "1 venta" : `${recent} ventas`} en 4 semanas · {product.salesCount} en total
        </span>
        <TrendChip change={stats?.change ?? null} compact />
      </span>
    </button>
  );
}
