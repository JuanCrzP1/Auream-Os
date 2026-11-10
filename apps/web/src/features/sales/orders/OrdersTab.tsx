import "./orders-tab.css";
import { useEffect, useMemo, useState } from "react";
import type { ProductSummary, SaleSummary } from "@contracts/SalesContracts";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { useSales } from "../hooks/useSales";
import { useSalesInsights } from "../hooks/useSalesInsights";
import { CurrencyCard } from "../insights/CurrencyCard";
import { SalesHero } from "../insights/SalesHero";
import { TopProducts } from "../insights/TopProducts";
import { PERIODS, periodRange, type SalesPeriod } from "./PeriodPills";
import { SaleDialog } from "./SaleDialog";
import type { SalesFilterValue } from "./SalesFilters";
import { SalesListPanel } from "./SalesListPanel";

/**
 * Ventas: la portada del periodo (lo vendido, su tendencia y la curva; las
 * otras monedas al lado), la lista y lo que más vende. «Por revisar»: solo la
 * lista de las incompletas, con su motivo. Tocar una venta la abre.
 */
export function OrdersTab({
  view,
  period,
  products,
  refreshKey,
  onCounts
}: {
  readonly view: "sales" | "review";
  readonly period: SalesPeriod;
  readonly products: ReadonlyArray<ProductSummary>;
  /** Cambia cuando se anota una venta desde la página: todo se vuelve a pedir. */
  readonly refreshKey: number;
  readonly onCounts: (counts: { readonly review: number; readonly canRecord: boolean; readonly canManage: boolean }) => void;
}) {
  const [filters, setFilters] = useState<SalesFilterValue>({ productId: "", search: "" });
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<SaleSummary | null>(null);
  const [edits, setEdits] = useState(0);

  // La búsqueda espera a que la persona deje de escribir.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(filters.search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const range = useMemo(() => (view === "review" ? {} : periodRange(period)), [period, view]);
  const query = useMemo(
    () => ({ ...range, ...(view === "review" ? { status: "review" as const } : {}), ...(filters.productId ? { productId: filters.productId } : {}), ...(search.length >= 2 ? { search } : {}) }),
    [range, filters.productId, search, view]
  );
  const sales = useSales(query);
  const { refresh } = sales;
  const { insights } = useSalesInsights({ ...range, ...(filters.productId ? { productId: filters.productId } : {}) }, refreshKey + edits);

  useEffect(() => {
    if (refreshKey > 0) void refresh();
  }, [refreshKey, refresh]);
  useEffect(() => {
    if (sales.data) onCounts({ review: sales.data.reviewCount, canRecord: sales.data.canRecord, canManage: sales.data.canManage });
  }, [sales.data, onCounts]);

  if (sales.status === "forbidden") return <StateCard icon={StateIcons.lock} title="Sin acceso a Ventas" description="Tu rol no permite ver las ventas de esta cuenta." />;
  if (sales.status === "error" || sales.status === "unavailable") {
    return (
      <StateCard
        role="alert"
        tone="warning"
        icon={StateIcons.offline}
        title="No pudimos cargar las ventas"
        description="Parece un problema de conexión momentáneo. Vuelve a intentarlo en unos segundos."
        actions={<RetryButton busy={false} onRetry={() => void refresh()} />}
      />
    );
  }

  const list = <SalesListPanel view={view} sales={sales} filters={filters} products={products} onFilters={setFilters} onOpen={setOpen} />;
  const others = insights?.currencies.slice(1, 3) ?? [];

  return (
    <div className="orders-tab">
      {view === "sales" && insights ? (
        <div className={`orders-tab__top${others.length === 0 ? " orders-tab__top--single" : ""}`}>
          <SalesHero insight={insights.currencies[0] ?? null} series={insights.series[0]} periodLabel={PERIODS.find((p) => p.id === period)?.long ?? ""} />
          {others.length > 0 ? (
            <div className="orders-tab__side">
              {others.map((currency) => (
                <CurrencyCard key={currency.currency} insight={currency} series={insights.series.find((s) => s.currency === currency.currency)} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {view === "sales" ? (
        <div className="orders-tab__bottom">
          {list}
          <TopProducts products={insights?.topProducts ?? []} />
        </div>
      ) : (
        list
      )}

      {open ? (
        <SaleDialog
          sale={open}
          products={products}
          canManage={sales.data?.canManage ?? false}
          onUpdate={async (id, request) => {
            const saved = await sales.update(id, request);
            setEdits((count) => count + 1);
            return saved;
          }}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}
