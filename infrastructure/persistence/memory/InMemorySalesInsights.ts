import type { SaleQuery } from "../../../domains/sales/application/SaleRepository";
import type { DayAmount, ProductCount, SalesInsightsReader, WeeklyCount } from "../../../domains/sales/application/SalesInsightsReader";
import { InMemorySaleRepository, type InMemorySalesStore } from "./InMemorySalesRepositories";

// Las sumas de la portada de Ventas en memoria (pruebas): las mismas reglas que SQL.

export class InMemorySalesInsights implements SalesInsightsReader {
  private readonly sales: InMemorySaleRepository;

  public constructor(private readonly store: InMemorySalesStore) {
    this.sales = new InMemorySaleRepository(store);
  }

  public async daily(tenantId: string, query: SaleQuery, currencies: ReadonlyArray<string>, timezone: string): Promise<ReadonlyArray<DayAmount>> {
    const format = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    const sums = new Map<string, DayAmount>();
    for (const sale of await this.approved(tenantId, query)) {
      if (!sale.currency || !currencies.includes(sale.currency)) continue;
      const day = format.format(new Date(sale.soldAt));
      const key = `${sale.currency}|${day}`;
      sums.set(key, { currency: sale.currency, day, amount: Math.round(((sums.get(key)?.amount ?? 0) + (sale.amount ?? 0)) * 100) / 100 });
    }
    return [...sums.values()];
  }

  public async topProducts(tenantId: string, query: SaleQuery, limit: number): Promise<ReadonlyArray<ProductCount>> {
    const counts = new Map<string, ProductCount>();
    for (const sale of await this.approved(tenantId, query)) {
      if (!sale.productId) continue;
      const product = this.store.products.get(sale.productId);
      const current = counts.get(sale.productId);
      counts.set(sale.productId, { productId: sale.productId, name: product?.name ?? sale.productName ?? "", kind: product?.kind ?? null, count: (current?.count ?? 0) + 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, limit);
  }

  public async weekly(tenantId: string, since: Date, now: Date): Promise<ReadonlyArray<WeeklyCount>> {
    const counts = new Map<string, WeeklyCount>();
    for (const sale of await this.approved(tenantId, { from: since, until: new Date(now.getTime() + 1) })) {
      if (!sale.productId) continue;
      const weeksAgo = Math.floor((now.getTime() - new Date(sale.soldAt).getTime()) / (7 * 86_400_000));
      const key = `${sale.productId}|${weeksAgo}`;
      counts.set(key, { productId: sale.productId, weeksAgo, count: (counts.get(key)?.count ?? 0) + 1 });
    }
    return [...counts.values()];
  }

  private approved(tenantId: string, query: SaleQuery) {
    return this.sales.list(tenantId, { ...query, status: "approved" }, null, Number.MAX_SAFE_INTEGER);
  }
}
