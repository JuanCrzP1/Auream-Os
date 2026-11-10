import { randomUUID } from "node:crypto";
import type { SaleStatus, SalesTotal } from "../../../contracts/SalesContracts";
import type { ProductRecord, ProductRepository } from "../../../domains/products/application/ProductRepository";
import type { Product, ProductDraft } from "../../../domains/products/domain/Product";
import type { SaleChanges, SaleCursor, SaleQuery, SaleRecord, SaleRepository } from "../../../domains/sales/application/SaleRepository";
import type { NewSale } from "../../../domains/sales/domain/Sale";

// ---------------------------------------------------------------------------
// Catálogo y ventas en memoria (pruebas): las mismas reglas que SQL — todo por
// cuenta, nombres únicos sin importar mayúsculas, `originKey` sin duplicados y
// totales solo con ventas aprobadas.
// ---------------------------------------------------------------------------

export class InMemorySalesStore {
  public readonly products = new Map<string, Product>();
  public readonly sales = new Map<string, SaleRecord & { readonly originKey: string | null }>();
}

export class InMemoryProductRepository implements ProductRepository {
  public constructor(private readonly store = new InMemorySalesStore(), private readonly now = () => new Date()) {}

  public async list(tenantId: string): Promise<ReadonlyArray<ProductRecord>> {
    return [...this.store.products.values()]
      .filter((product) => product.tenantId === tenantId)
      .sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name))
      .map((product) => ({
        ...product,
        salesCount: [...this.store.sales.values()].filter((sale) => sale.tenantId === tenantId && sale.productId === product.id && sale.status === "approved").length
      }));
  }

  public async find(tenantId: string, productId: string): Promise<Product | null> {
    const product = this.store.products.get(productId);
    return product && product.tenantId === tenantId ? product : null;
  }

  public async count(tenantId: string): Promise<number> {
    return [...this.store.products.values()].filter((product) => product.tenantId === tenantId).length;
  }

  public async nameTaken(tenantId: string, name: string, exceptId?: string): Promise<boolean> {
    return [...this.store.products.values()].some((p) => p.tenantId === tenantId && p.id !== exceptId && p.name.toLowerCase() === name.toLowerCase());
  }

  public async create(tenantId: string, draft: ProductDraft): Promise<Product> {
    const at = this.now().toISOString();
    const product: Product = { id: randomUUID(), tenantId, ...draft, createdAt: at, updatedAt: at };
    this.store.products.set(product.id, product);
    return product;
  }

  public async update(tenantId: string, productId: string, draft: ProductDraft): Promise<Product | null> {
    const current = await this.find(tenantId, productId);
    if (!current) return null;
    const product: Product = { ...current, ...draft, updatedAt: this.now().toISOString() };
    this.store.products.set(productId, product);
    return product;
  }
}

export class InMemorySaleRepository implements SaleRepository {
  public constructor(private readonly store = new InMemorySalesStore()) {}

  public async insert(tenantId: string, sale: NewSale, status: SaleStatus, reviewReason: string | null) {
    const existing = sale.originKey ? [...this.store.sales.values()].find((s) => s.tenantId === tenantId && s.originKey === sale.originKey) : undefined;
    if (existing) return { sale: existing, created: false };
    const record = { ...sale, id: randomUUID(), status, reviewReason, connectionName: null, flowName: null, recordedByName: null };
    this.store.sales.set(record.id, record);
    return { sale: record, created: true };
  }

  public async find(tenantId: string, saleId: string): Promise<SaleRecord | null> {
    const sale = this.store.sales.get(saleId);
    return sale && sale.tenantId === tenantId ? sale : null;
  }

  public async update(tenantId: string, saleId: string, changes: SaleChanges): Promise<SaleRecord | null> {
    const current = this.store.sales.get(saleId);
    if (!current || current.tenantId !== tenantId) return null;
    const updated = { ...current, ...changes };
    this.store.sales.set(saleId, updated);
    return updated;
  }

  public async list(tenantId: string, query: SaleQuery, cursor: SaleCursor | null, limit: number): Promise<ReadonlyArray<SaleRecord>> {
    return this.matching(tenantId, query)
      .sort((a, b) => b.soldAt.localeCompare(a.soldAt) || b.id.localeCompare(a.id))
      .filter((sale) => !cursor || sale.soldAt < cursor.soldAt || (sale.soldAt === cursor.soldAt && sale.id < cursor.id))
      .slice(0, limit);
  }

  public async totals(tenantId: string, query: SaleQuery): Promise<ReadonlyArray<SalesTotal>> {
    const totals = new Map<string, SalesTotal>();
    for (const sale of this.matching(tenantId, { ...query, status: "approved" })) {
      const current = totals.get(sale.currency!) ?? { currency: sale.currency!, amount: 0, count: 0 };
      totals.set(sale.currency!, { currency: current.currency, amount: Math.round((current.amount + sale.amount!) * 100) / 100, count: current.count + 1 });
    }
    return [...totals.values()].sort((a, b) => b.amount - a.amount);
  }

  public async countByStatus(tenantId: string, status: SaleStatus): Promise<number> {
    return [...this.store.sales.values()].filter((sale) => sale.tenantId === tenantId && sale.status === status).length;
  }

  private matching(tenantId: string, query: SaleQuery): SaleRecord[] {
    const needle = query.search?.toLowerCase();
    return [...this.store.sales.values()].filter(
      (sale) =>
        sale.tenantId === tenantId &&
        (!query.status || sale.status === query.status) &&
        (!query.productId || sale.productId === query.productId) &&
        (!query.currency || sale.currency === query.currency) &&
        (!query.source || sale.source === query.source) &&
        (!query.from || new Date(sale.soldAt) >= query.from) &&
        (!query.until || new Date(sale.soldAt) < query.until) &&
        (!needle ||
          [sale.customerName, sale.customerPhone, sale.receiptReference].some((value) => value?.toLowerCase().includes(needle)) ||
          sale.adSourceId === query.search)
    );
  }
}
