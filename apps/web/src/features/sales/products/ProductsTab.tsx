import "./products-tab.css";
import { useEffect, useState } from "react";
import type { ProductSummary } from "@contracts/SalesContracts";
import type { ProductStats } from "@contracts/SalesInsightsContracts";
import { fetchProductStats } from "../services/salesApi";
import { CatalogEmpty } from "./CatalogEmpty";
import { ProductCard } from "./ProductCard";

/**
 * El catálogo: cada producto con su tipo, sus precios por país y cómo se vende
 * semana a semana. Los archivados van al final, atenuados. Sin productos, los
 * tres pasos para empezar. Si las semanas no cargan, las tarjetas igual se ven.
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
  const [stats, setStats] = useState<ReadonlyMap<string, ProductStats>>(new Map());

  useEffect(() => {
    let alive = true;
    fetchProductStats()
      .then(({ products: rows }) => alive && setStats(new Map(rows.map((row) => [row.productId, row]))))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [products]);

  if (products.length === 0) return <CatalogEmpty canManage={canManage} onCreate={onCreate} />;

  return (
    <ul className="products-grid" aria-label="Productos">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} stats={stats.get(product.id)} canManage={canManage} onEdit={() => onEdit(product)} />
        </li>
      ))}
    </ul>
  );
}
