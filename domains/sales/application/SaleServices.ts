import { countryOfPhone } from "../../../contracts/Countries";
import {
  SALE_SOURCES,
  SALE_STATUSES,
  type RecordSaleRequest,
  type SaleFilters,
  type SaleListResponse,
  type SaleSummary,
  type UpdateSaleRequest
} from "../../../contracts/SalesContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { parseCurrency, parseMoney } from "../domain/Money";
import { requireAmount, requireCountry, requireCurrency, soldAtOf } from "../domain/SaleInput";
import { cleanPhone, cleanText, initialStatus, missingForApproval } from "../domain/Sale";
import { salePeriod } from "../domain/SalePeriod";
import type { ProductCatalog } from "./ProductCatalog";
import { decodeCursor, encodeCursor, toSummary } from "./saleViews";
import type { SaleQuery, SaleRepository } from "./SaleRepository";

// ---------------------------------------------------------------------------
// Ventas desde la API: la lista con filtros y totales, anotar una venta a mano
// (el asesor que cerró por chat) y revisarla, corregirla o anularla. Quién
// puede cada cosa lo decide la ruta (`sales.read` · `write` · `manage`).
// Las ventas de los flujos entran por `FlowSaleRecorder`.
// ---------------------------------------------------------------------------

const PAGE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SaleActor {
  readonly tenantId: string;
  readonly userId: string;
  readonly canRecord: boolean;
  readonly canManage: boolean;
}

export class SaleServices {
  public constructor(
    private readonly sales: SaleRepository,
    private readonly catalog: ProductCatalog,
    /** Zona horaria de la empresa (los filtros por fecha van en su hora). */
    private readonly timezoneOf: (tenantId: string) => Promise<string>
  ) {}

  public async list(actor: SaleActor, filters: SaleFilters): Promise<SaleListResponse> {
    const query = await this.query(actor.tenantId, filters);
    const rows = await this.sales.list(actor.tenantId, query, decodeCursor(filters.cursor), PAGE + 1);
    const page = rows.slice(0, PAGE);
    const last = page[page.length - 1];
    return {
      sales: page.map(toSummary),
      totals: query.status && query.status !== "approved" ? [] : await this.sales.totals(actor.tenantId, query),
      reviewCount: await this.sales.countByStatus(actor.tenantId, "review"),
      nextCursor: rows.length > PAGE && last ? encodeCursor({ soldAt: last.soldAt, id: last.id }) : null,
      canRecord: actor.canRecord,
      canManage: actor.canManage
    };
  }

  /** Venta anotada a mano. Completa: aprobada. Si falta algo: «Por revisar». */
  public async record(actor: SaleActor, input: Partial<RecordSaleRequest>): Promise<SaleSummary> {
    const product = input.productId ? await this.requireProduct(actor.tenantId, input.productId) : null;
    const phone = cleanPhone(input.customerPhone);
    const amount = input.amount === null || input.amount === undefined || input.amount === "" ? null : parseMoney(input.amount);
    if (input.amount && amount === null) throw new ValidationError("El monto no es un número válido.");
    const draft = {
      productId: product?.id ?? null,
      amount,
      currency: input.currency ? requireCurrency(input.currency) : null
    };
    const { sale } = await this.sales.insert(
      actor.tenantId,
      {
        tenantId: actor.tenantId,
        source: "manual",
        ...draft,
        productName: product?.name ?? null,
        country: input.country ? requireCountry(input.country) : countryOfPhone(phone),
        contactId: null,
        customerName: cleanText(input.customerName, 120),
        customerPhone: phone,
        connectionId: null,
        flowKey: null,
        adSourceId: null,
        receiptReference: null,
        note: cleanText(input.note, 500) ?? "",
        recordedBy: actor.userId,
        soldAt: soldAtOf(input.soldAt),
        originKey: null
      },
      ...statusOf(initialStatus(draft))
    );
    return toSummary(sale);
  }

  /** Corregir, aprobar (si está completa) o anular (con motivo). */
  public async update(actor: SaleActor, saleId: string, input: Partial<UpdateSaleRequest>): Promise<SaleSummary> {
    const current = UUID.test(saleId) ? await this.sales.find(actor.tenantId, saleId) : null;
    if (!current) throw new NotFoundError("Esa venta no existe.");
    const productChanged = input.productId !== undefined && input.productId !== current.productId;
    const product = productChanged && input.productId ? await this.requireProduct(actor.tenantId, input.productId) : null;
    const next = {
      productId: input.productId === undefined ? current.productId : (product?.id ?? null),
      productName: input.productId === undefined || !productChanged ? current.productName : (product?.name ?? null),
      amount: input.amount === undefined ? current.amount : input.amount === null ? null : requireAmount(input.amount),
      currency: input.currency === undefined ? current.currency : input.currency === null ? null : requireCurrency(input.currency),
      country: input.country === undefined ? current.country : input.country === null ? null : requireCountry(input.country),
      customerName: input.customerName === undefined ? current.customerName : cleanText(input.customerName, 120),
      note: input.note === undefined ? current.note : (cleanText(input.note, 500) ?? "")
    };
    const wanted = input.status === undefined ? current.status : SALE_STATUSES.includes(input.status) ? input.status : current.status;
    let reviewReason: string | null = null;
    if (wanted === "void") {
      reviewReason = cleanText(input.voidReason, 200) ?? (current.status === "void" ? current.reviewReason : null);
      if (!reviewReason) throw new ValidationError("Escribe por qué se anula la venta.");
    } else if (wanted === "approved") {
      const missing = missingForApproval(next);
      if (missing) throw new ValidationError(`No se puede aprobar: ${missing.charAt(0).toLowerCase()}${missing.slice(1)}`);
    } else {
      reviewReason = missingForApproval(next) ?? current.reviewReason;
    }
    const saved = await this.sales.update(actor.tenantId, saleId, { ...next, status: wanted, reviewReason, recordedBy: actor.userId });
    if (!saved) throw new NotFoundError("Esa venta no existe.");
    return toSummary(saved);
  }

  private async requireProduct(tenantId: string, productId: string) {
    const product = await this.catalog.findActive(tenantId, productId);
    if (!product) throw new ValidationError("Ese producto no existe o está archivado.");
    return product;
  }

  private async query(tenantId: string, filters: SaleFilters): Promise<SaleQuery> {
    const period = filters.from || filters.to ? salePeriod(filters.from, filters.to, await this.timezoneOf(tenantId)) : { from: null, until: null };
    return {
      ...(filters.status && SALE_STATUSES.includes(filters.status) ? { status: filters.status } : {}),
      ...(filters.productId && UUID.test(filters.productId) ? { productId: filters.productId } : {}),
      ...(filters.currency && parseCurrency(filters.currency) ? { currency: parseCurrency(filters.currency)! } : {}),
      ...(filters.source && SALE_SOURCES.includes(filters.source) ? { source: filters.source } : {}),
      ...(filters.search && filters.search.trim().length >= 2 ? { search: filters.search.trim().slice(0, 80) } : {}),
      from: period.from,
      until: period.until
    };
  }
}

const statusOf = (decided: ReturnType<typeof initialStatus>) => [decided.status, decided.reviewReason] as const;
