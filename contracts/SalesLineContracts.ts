// ---------------------------------------------------------------------------
// Líneas de venta — contrato compartido por la API, la web y el MCP.
//
// Una línea es una parte del negocio que se mide aparte («Venezuela», «Dilo
// cantando Colombia»): los productos que vende, los números por los que vende
// (vacío = todos) y las campañas de Meta que la promocionan. En el Dashboard,
// elegir una línea muestra sus ventas, su gasto, su ROAS y su ganancia.
// ---------------------------------------------------------------------------

/** Los colores que se pueden elegir (los de la marca y sus acompañantes). */
export const SALES_LINE_COLORS = ["#6c4fe0", "#0d9488", "#e0a400", "#e11d48", "#3b6fe0", "#16a34a", "#f97316", "#64748b"] as const;

export const SALES_LINE_NAME_MAX = 40;
export const SALES_LINES_PER_TENANT_MAX = 30;

export interface SalesLineSummary {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly productIds: ReadonlyArray<string>;
  /** Vacío: todos los números. */
  readonly connectionIds: ReadonlyArray<string>;
  /** Ids de campaña de Meta (los de `ad_entities.campaign_id`). */
  readonly campaignIds: ReadonlyArray<string>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SalesLineListResponse {
  readonly lines: ReadonlyArray<SalesLineSummary>;
  /** Quien mira puede crear, editar y borrar líneas (`sales.manage`). */
  readonly canManage: boolean;
}

export interface SaveSalesLineRequest {
  readonly name: string;
  readonly color?: string;
  readonly productIds?: ReadonlyArray<string>;
  readonly connectionIds?: ReadonlyArray<string>;
  readonly campaignIds?: ReadonlyArray<string>;
}
