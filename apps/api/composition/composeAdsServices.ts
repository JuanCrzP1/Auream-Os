import { MetaDataDeletionService } from "../../../domains/ads/application/MetaDataDeletionService";
import { SqlMetaDataDeletions } from "../../../infrastructure/persistence/sql/SqlMetaDataDeletions";
import type { ApiConfig } from "../config/loadApiConfig";
import { AdConnectionServices } from "../../../domains/ads/application/AdConnectionServices";
import { AdsSyncService } from "../../../domains/ads/application/AdsSyncService";
import { OAuthStateSigner } from "../../../domains/ads/application/OAuthState";
import { AdsDashboardService } from "../../../domains/analytics/application/AdsDashboardService";
import { AttentionDashboardService } from "../../../domains/analytics/application/AttentionDashboardService";
import { SalesDashboardService } from "../../../domains/analytics/application/SalesDashboardService";
import { DashboardScopeResolver, type SalesLineLookup } from "../../../domains/analytics/application/DashboardScopeResolver";
import { LineComparisonService, type SalesLineDirectory } from "../../../domains/analytics/application/LineComparisonService";
import { SalesExportService } from "../../../domains/analytics/application/SalesExportService";
import { SqlSalesExport } from "../../../infrastructure/persistence/sql/SqlSalesExport";
import type { OtherExpensesReader } from "../../../domains/analytics/application/OtherExpenseLedger";
import type { TaskScheduler } from "../../../domains/scheduling/application/TaskScheduler";
import { MetaMarketingClient } from "../../../infrastructure/meta/MetaMarketingClient";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlAdsRepository } from "../../../infrastructure/persistence/sql/SqlAdsRepository";
import { SqlDashboardAds } from "../../../infrastructure/persistence/sql/SqlDashboardAds";
import { SqlDashboardAttention } from "../../../infrastructure/persistence/sql/SqlDashboardAttention";
import { SqlDashboardSales } from "../../../infrastructure/persistence/sql/SqlDashboardSales";
import { SqlFxRates } from "../../../infrastructure/persistence/sql/SqlFxRates";
import type { FxRates } from "../../../domains/analytics/application/CurrencyConverter";
import { SqlTenantResolver } from "../../../infrastructure/persistence/sql/SqlTenantResolver";
import { AesGcmSecretCipher } from "../../../platform/security/secrets/AesGcmSecretCipher";
import { AdsSyncTaskHandler, SchedulerAdsSync } from "./adsSyncAdapters";

// ---------------------------------------------------------------------------
// composeAdsServices — Meta Ads (conexión y sincronización) y el Dashboard
// (Ventas · Anuncios · Atención). Único punto que elige el proveedor (Meta) y
// la base. Sin llave de cifrado, Meta Ads no se ofrece (el token no se guarda
// en claro nunca) pero el Dashboard sí funciona.
// ---------------------------------------------------------------------------

export interface DashboardModule {
  /** Las tasas de cambio oficiales (se actualizan solas: ver `SqlFxRates`). */
  readonly fx: FxRates;
  readonly sales: SalesDashboardService;
  readonly ads: AdsDashboardService;
  readonly attention: AttentionDashboardService;
  /** Comparar líneas (sin módulo de líneas, no hay). */
  readonly lines?: LineComparisonService;
  /** Descargar ventas. */
  readonly export?: SalesExportService;
}

export interface AdsModule {
  /** `null` sin llave de cifrado (desarrollo sin secretos). */
  readonly connection: AdConnectionServices | null;
  readonly syncHandler: AdsSyncTaskHandler | null;
  readonly dashboard: DashboardModule;
  /** Adonde vuelve la web al terminar el inicio de sesión de Meta. */
  readonly appOrigin: string;
  /** Avisos de Meta (quitar la app, borrar datos). `null` sin la app de Meta en el servidor. */
  readonly dataDeletion: MetaDataDeletionService | null;
}

export function composeAdsServices(
  config: ApiConfig,
  sql: SqlClient,
  scheduler: TaskScheduler,
  onError: (error: unknown, context: Record<string, unknown>) => void,
  /** Las líneas de venta, para filtrar el Dashboard por línea. */
  lines: SalesLineLookup | null = null,
  /** Pasó más de un día sin tasas de cambio nuevas. */
  onFxStale: (info: { readonly lastDay: string | null; readonly errors: ReadonlyArray<string> }) => void = () => undefined,
  /** Los gastos fuera de Meta, para restarlos de la ganancia. */
  expenses: OtherExpensesReader | null = null,
  /** Todas las líneas, para compararlas. */
  directory: SalesLineDirectory | null = null
): AdsModule {
  const tenants = new SqlTenantResolver(sql, config.defaultTimezone);
  const timezoneOf = async (tenantId: string) => (await tenants.resolve(tenantId)).timezone;
  const fx = new SqlFxRates(sql, undefined, undefined, { onStale: onFxStale });
  const adsReader = new SqlDashboardAds(sql);
  const salesReader = new SqlDashboardSales(sql);
  const scopes = new DashboardScopeResolver(lines);
  const dashboard: DashboardModule = {
    fx,
    sales: new SalesDashboardService(salesReader, adsReader, fx, timezoneOf, undefined, scopes, expenses),
    ads: new AdsDashboardService(adsReader, fx, timezoneOf, undefined, scopes),
    attention: new AttentionDashboardService(new SqlDashboardAttention(sql), fx, timezoneOf, undefined, scopes),
    export: new SalesExportService(new SqlSalesExport(sql), adsReader, fx, timezoneOf, scopes),
    ...(directory ? { lines: new LineComparisonService(salesReader, adsReader, fx, timezoneOf, directory, expenses) } : {})
  };
  // Quitar la app o pedir el borrado desde Facebook: se verifica con el secreto de la app.
  const dataDeletion = config.metaApp
    ? new MetaDataDeletionService(config.metaApp.appSecret, new SqlMetaDataDeletions(sql), new SqlAdsRepository(sql), `${config.publicAppOrigin}/eliminar-datos`)
    : null;
  if (!config.credentialsKeyRing) return { connection: null, syncHandler: null, dashboard, appOrigin: config.publicAppOrigin, dataDeletion };

  const repository = new SqlAdsRepository(sql);
  const provider = new MetaMarketingClient(config.metaApp, config.metaGraphVersion);
  const cipher = new AesGcmSecretCipher(config.credentialsKeyRing);
  const syncScheduler = new SchedulerAdsSync(scheduler);
  // El `state` del inicio de sesión se firma con el secreto de la app (solo lo conoce el servidor).
  const signer = config.metaApp ? new OAuthStateSigner(config.metaApp.appSecret) : null;
  return {
    connection: new AdConnectionServices(repository, provider, cipher, syncScheduler, signer, config.metaOAuthRedirectUrl),
    syncHandler: new AdsSyncTaskHandler(new AdsSyncService(repository, provider, cipher, syncScheduler, onError)),
    dashboard,
    appOrigin: config.publicAppOrigin,
    dataDeletion
  };
}
