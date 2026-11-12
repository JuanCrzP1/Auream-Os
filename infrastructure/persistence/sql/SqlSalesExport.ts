import type { Period } from "../../../domains/analytics/application/DashboardPeriod";
import type { DashboardScope } from "../../../domains/analytics/application/DashboardReaders";
import type { SaleExportRow, SalesExportReader } from "../../../domains/analytics/application/SalesExportService";
import { adCondition, tzParam, where } from "./SqlDashboardSales";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlSalesExport — las ventas aprobadas del periodo para «Descargar ventas»,
// con los mismos filtros que el Dashboard (`where`): el número que vendió, el
// anuncio y su campaña (de las cuentas conectadas) y la fecha y hora en la
// zona de la empresa. Una sola consulta, con tope de filas.
// ---------------------------------------------------------------------------

interface ExportRecord {
  id: string;
  day: string;
  time: string;
  customer_name: string | null;
  customer_phone: string | null;
  country: string | null;
  product_name: string | null;
  amount: string;
  currency: string;
  connection_name: string | null;
  from_ad: boolean;
  has_ad_source: boolean;
  campaign_name: string | null;
  ad_name: string | null;
  source: string;
  receipt_reference: string | null;
  note: string | null;
}

export class SqlSalesExport implements SalesExportReader {
  public constructor(private readonly sql: SqlExecutor) {}

  public async rows(tenantId: string, period: Period, scope: DashboardScope, timezone: string, limit: number): Promise<ReadonlyArray<SaleExportRow>> {
    const params: unknown[] = [tenantId];
    const condition = where(period, scope, params);
    const tz = tzParam(params, timezone);
    const byCampaign = adCondition(scope, params);
    params.push(limit);
    const { rows } = await this.sql.query<ExportRecord>(
      `select s.id, to_char(s.sold_at at time zone ${tz}, 'YYYY-MM-DD') as day, to_char(s.sold_at at time zone ${tz}, 'HH24:MI') as time,
              s.customer_name, s.customer_phone, s.country, s.product_name, s.amount, s.currency,
              c.name as connection_name, (ad.external_id is not null) as from_ad, (s.ad_source_id is not null) as has_ad_source, camp.name as campaign_name,
              coalesce(ad.name, case when s.ad_source_id is not null then 'Anuncio ' || s.ad_source_id end) as ad_name,
              s.source, s.receipt_reference, s.note
         from sales s
         left join whatsapp_connections c on c.tenant_id = s.tenant_id and c.id = s.connection_id
         -- El anuncio (de las cuentas conectadas y, si se eligieron, de esas campañas) y el nombre de su campaña.
         left join lateral (select e.external_id, e.name, e.campaign_id from ad_entities e
                             where e.tenant_id = s.tenant_id and e.level = 'ad' and e.external_id = s.ad_source_id ${byCampaign} limit 1) ad on true
         left join lateral (select name from ad_entities where tenant_id = s.tenant_id and level = 'campaign' and external_id = ad.campaign_id limit 1) camp on true
        where ${condition}
        order by s.sold_at desc, s.id desc
        limit $${params.length}`,
      params
    );
    return rows.map((row) => ({
      id: row.id,
      day: row.day,
      time: row.time,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      country: row.country?.trim() || null,
      productName: row.product_name,
      amount: Number(row.amount),
      currency: row.currency.trim(),
      connectionName: row.connection_name,
      fromAd: row.from_ad,
      hasAdSource: row.has_ad_source,
      campaignName: row.campaign_name,
      adName: row.ad_name,
      source: row.source,
      receiptReference: row.receipt_reference,
      note: row.note ?? ""
    }));
  }
}
