import type { SalesLineLookup } from "../../../domains/analytics/application/DashboardScopeResolver";
import { SalesLineServices } from "../../../domains/sales-lines/application/SalesLineServices";
import type { SqlExecutor } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlSalesLineRepository } from "../../../infrastructure/persistence/sql/SqlSalesLineRepository";

// ---------------------------------------------------------------------------
// Líneas de venta: el módulo (para `/sales-lines` y el MCP) y lo que el
// Dashboard necesita de él (qué junta una línea), sin que Analytics conozca
// el módulo de líneas.
// ---------------------------------------------------------------------------

export interface SalesLineModule {
  readonly lines: SalesLineServices;
  readonly lookup: SalesLineLookup;
}

export function composeSalesLineServices(sql: SqlExecutor): SalesLineModule {
  const lines = new SalesLineServices(new SqlSalesLineRepository(sql));
  return {
    lines,
    lookup: {
      scopeOf: async (tenantId, lineId) => {
        const line = await lines.find(tenantId, lineId);
        return line ? { productIds: line.productIds, connectionIds: line.connectionIds, campaignIds: line.campaignIds } : null;
      }
    }
  };
}
