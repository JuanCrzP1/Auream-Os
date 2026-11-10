import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "./sales-page.css";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ProductSummary } from "@contracts/SalesContracts";
import { useProductCatalog } from "@shared/products/useProductCatalog";
import { PillTabs } from "@shared/ui/pill-tabs/PillTabs";
import { fetchSales, recordSale } from "../services/salesApi";
import { OrdersTab } from "../orders/OrdersTab";
import { PeriodPills, type SalesPeriod } from "../orders/PeriodPills";
import { RecordSaleDialog } from "../orders/RecordSaleDialog";
import { ProductDialog } from "../products/ProductDialog";
import { ProductsTab } from "../products/ProductsTab";
import { SalesIcons } from "../salesIcons";

type Tab = "sales" | "review" | "products";
const TABS: ReadonlyArray<Tab> = ["sales", "review", "products"];
const isTab = (value: string | null): value is Tab => TABS.some((tab) => tab === value);

type Dialog = { readonly kind: "record" } | { readonly kind: "product"; readonly product: ProductSummary | null } | null;

/**
 * Ventas: cada venta con su producto, monto, cliente, número, flujo y anuncio
 * (las registra el bloque Registrar venta o un asesor), las que esperan
 * revisión y el catálogo de Productos con su precio por país. La pestaña
 * viaja en la dirección (`?tab=products`) para enlazarla desde el editor.
 */
export function SalesPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: Tab = isTab(requested) ? requested : "sales";
  const catalog = useProductCatalog();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [counts, setCounts] = useState({ review: 0, canRecord: false, canManage: false });
  const [refreshKey, setRefreshKey] = useState(0);
  const [period, setPeriod] = useState<SalesPeriod>("30d");
  const onCounts = useCallback((next: typeof counts) => setCounts(next), []);

  // El número de «Por revisar» y los permisos, abra la pestaña que abra (Productos no carga ventas).
  useEffect(() => {
    let alive = true;
    fetchSales({ status: "review" })
      .then((response) => alive && setCounts({ review: response.reviewCount, canRecord: response.canRecord, canManage: response.canManage }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [refreshKey]);
  const canManageProducts = catalog.canManage;

  return (
    <div className="ui-page sales-page">
      <header className="ui-page__header">
        <div>
          <h1 className="ui-page__title">Ventas</h1>
          <p className="ui-page__subtitle">Cada venta con su producto, su cliente y el anuncio que la trajo. Solo las aprobadas suman.</p>
        </div>
        <div className="sales-page__actions">
          {/* Sin productos, el botón vive en la tarjeta «Crea tu catálogo». */}
          {tab === "products" && canManageProducts && catalog.products.length > 0 ? (
            <button type="button" className="ui-btn ui-btn--primary" onClick={() => setDialog({ kind: "product", product: null })}>
              {SalesIcons.plus}
              Nuevo producto
            </button>
          ) : null}
          {tab !== "products" && counts.canRecord ? (
            <button type="button" className="ui-btn ui-btn--primary" onClick={() => setDialog({ kind: "record" })}>
              {SalesIcons.plus}
              Anotar venta
            </button>
          ) : null}
        </div>
      </header>

      <div className="ui-panel sales-page__panel">
        <div className="sales-page__toolbar">
          <PillTabs
            label="Secciones de ventas"
            tabs={[
              { id: "sales", label: "Ventas" },
              { id: "review", label: "Por revisar", count: counts.review, alert: true },
              { id: "products", label: "Productos", count: catalog.products.length }
            ]}
            selected={tab}
            onSelect={(next) => setParams({ tab: next }, { replace: true })}
          />
          {tab === "sales" ? <PeriodPills value={period} onChange={setPeriod} /> : null}
        </div>
        <div role="tabpanel" aria-label={tab === "products" ? "Productos" : tab === "review" ? "Por revisar" : "Ventas"}>
          {tab === "products" ? (
            catalog.status === "loading" ? (
              <div className="sales-page__loading" aria-busy="true" aria-label="Cargando los productos" />
            ) : (
              <ProductsTab
                products={catalog.products}
                canManage={canManageProducts}
                onCreate={() => setDialog({ kind: "product", product: null })}
                onEdit={(product) => setDialog({ kind: "product", product })}
              />
            )
          ) : (
            <OrdersTab key={tab} view={tab} period={period} products={catalog.products} refreshKey={refreshKey} onCounts={onCounts} />
          )}
        </div>
      </div>

      {dialog?.kind === "record" ? (
        <RecordSaleDialog
          products={catalog.products}
          onRecord={async (request) => {
            const sale = await recordSale(request);
            setRefreshKey((key) => key + 1);
            return sale;
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "product" ? (
        <ProductDialog
          product={dialog.product}
          onSave={(request) => (dialog.product ? catalog.update(dialog.product.id, request) : catalog.create(request))}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
