import type { DashboardFilters } from "../../../contracts/DashboardContracts";
import type { DashboardScope } from "./DashboardReaders";

// ---------------------------------------------------------------------------
// De los filtros que pidió la pantalla (o el agente) a la parte del negocio
// que se mira. Lo que se filtra a mano gana; lo que no, sale de la línea de
// venta elegida. Los ids inválidos se ignoran (nunca rompen la consulta).
// ---------------------------------------------------------------------------

/** Lo que junta una línea de venta (lo da el módulo de líneas, sin que Analytics lo conozca). */
export interface LineScope {
  readonly productIds: ReadonlyArray<string>;
  readonly connectionIds: ReadonlyArray<string>;
  readonly campaignIds: ReadonlyArray<string>;
}

export interface SalesLineLookup {
  /** La línea de la cuenta, o `null` si no existe. */
  scopeOf(tenantId: string, lineId: string): Promise<LineScope | null>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Ids de campaña del proveedor (Meta usa dígitos); la misma regla que las líneas. */
const META_ID = /^[A-Za-z0-9_.:-]{1,64}$/;

const valid = (values: ReadonlyArray<string> | undefined, pattern: RegExp) => (values ?? []).map((value) => value.trim()).filter((value) => pattern.test(value));

/** Una lista pedida a mano (o el filtro único de antes); `undefined` si no se pidió. */
function asked(list: ReadonlyArray<string> | undefined, single: string | undefined, pattern: RegExp): string[] | undefined {
  if (list !== undefined) return valid(list, pattern);
  return single ? valid([single], pattern) : undefined;
}

function compact(scope: { connectionIds: string[]; productIds: string[]; campaignIds: string[] }): DashboardScope {
  return {
    ...(scope.connectionIds.length ? { connectionIds: scope.connectionIds } : {}),
    ...(scope.productIds.length ? { productIds: scope.productIds } : {}),
    ...(scope.campaignIds.length ? { campaignIds: scope.campaignIds } : {})
  };
}

/** Solo lo pedido a mano (sin líneas): para pruebas y quien no usa líneas. */
export function scopeOf(filters: DashboardFilters): DashboardScope {
  return compact({
    connectionIds: asked(filters.connectionIds, filters.connectionId, UUID) ?? [],
    productIds: asked(filters.productIds, filters.productId, UUID) ?? [],
    campaignIds: asked(filters.campaignIds, undefined, META_ID) ?? []
  });
}

export class DashboardScopeResolver {
  public constructor(private readonly lines: SalesLineLookup | null = null) {}

  /** Lo que junta una línea (sin filtros a mano), o `null` si no existe. */
  public async lineScope(tenantId: string, lineId: string): Promise<DashboardScope | null> {
    if (!this.lines || !UUID.test(lineId)) return null;
    const line = await this.lines.scopeOf(tenantId, lineId);
    return line ? compact({ connectionIds: valid(line.connectionIds, UUID), productIds: valid(line.productIds, UUID), campaignIds: valid(line.campaignIds, META_ID) }) : null;
  }

  public async resolve(tenantId: string, filters: DashboardFilters): Promise<DashboardScope> {
    const line = filters.lineId && this.lines && UUID.test(filters.lineId) ? await this.lines.scopeOf(tenantId, filters.lineId) : null;
    return compact({
      connectionIds: asked(filters.connectionIds, filters.connectionId, UUID) ?? valid(line?.connectionIds, UUID),
      productIds: asked(filters.productIds, filters.productId, UUID) ?? valid(line?.productIds, UUID),
      campaignIds: asked(filters.campaignIds, undefined, META_ID) ?? valid(line?.campaignIds, META_ID)
    });
  }
}
