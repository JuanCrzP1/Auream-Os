import type { ApiConfig } from "../config/loadApiConfig";
import { ProductServices } from "../../../domains/products/application/ProductServices";
import { FlowSaleRecorder } from "../../../domains/sales/application/FlowSaleRecorder";
import { SaleServices } from "../../../domains/sales/application/SaleServices";
import { SalesInsights } from "../../../domains/sales/application/SalesInsights";
import type { SalesLedger } from "../../../flow-engine/ports/SalesLedger";
import { InMemoryProductRepository, InMemorySaleRepository, InMemorySalesStore } from "../../../infrastructure/persistence/memory/InMemorySalesRepositories";
import { InMemorySalesInsights } from "../../../infrastructure/persistence/memory/InMemorySalesInsights";
import { SqlSalesInsights } from "../../../infrastructure/persistence/sql/SqlSalesInsights";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlProductRepository } from "../../../infrastructure/persistence/sql/SqlProductRepository";
import { SqlSaleRepository } from "../../../infrastructure/persistence/sql/SqlSaleRepository";
import { SqlTenantResolver } from "../../../infrastructure/persistence/sql/SqlTenantResolver";
import { DomainSalesLedger } from "./DomainSalesLedger";

// ---------------------------------------------------------------------------
// composeSalesServices — Ventas y Productos: el catálogo (`/products`), las
// ventas (`/sales`) y el puente del bloque «Registrar venta» (guarda en los
// flujos reales; calcula sin guardar en la simulación). Único punto que elige
// SQL (producción) o memoria (pruebas y desarrollo sin base).
// ---------------------------------------------------------------------------

export interface SalesModule {
  readonly products: ProductServices;
  readonly sales: SaleServices;
  /** La portada de Ventas (solo lee). */
  readonly insights: SalesInsights;
  /** Flujos reales: guarda la venta. */
  readonly ledger: SalesLedger;
  /** Simulación y Laboratorio: calcula la venta sin guardarla. */
  readonly preview: SalesLedger;
}

export function composeSalesServices(config: ApiConfig, sql: SqlClient): SalesModule {
  const useSql = config.automationsStore === "sql";
  const store = new InMemorySalesStore();
  const productRepository = useSql ? new SqlProductRepository(sql) : new InMemoryProductRepository(store);
  const saleRepository = useSql ? new SqlSaleRepository(sql) : new InMemorySaleRepository(store);
  const tenants = useSql ? new SqlTenantResolver(sql, config.defaultTimezone) : null;
  const timezoneOf = async (tenantId: string) => (tenants ? (await tenants.resolve(tenantId)).timezone : config.defaultTimezone);

  const products = new ProductServices(productRepository);
  // Ventas usa el catálogo por su puerto: `ProductServices.findActive` lo cumple.
  const recorder = new FlowSaleRecorder(saleRepository, products);
  return {
    products,
    sales: new SaleServices(saleRepository, products, timezoneOf),
    insights: new SalesInsights(saleRepository, useSql ? new SqlSalesInsights(sql) : new InMemorySalesInsights(store), timezoneOf),
    ledger: new DomainSalesLedger(recorder, "record"),
    preview: new DomainSalesLedger(recorder, "preview")
  };
}
