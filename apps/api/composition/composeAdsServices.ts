import type { ApiConfig } from "../config/loadApiConfig";
import { AdConnectionServices } from "../../../domains/ads/application/AdConnectionServices";
import { AdsSyncService } from "../../../domains/ads/application/AdsSyncService";
import { OAuthStateSigner } from "../../../domains/ads/application/OAuthState";
import { AdsDashboardService } from "../../../domains/analytics/application/AdsDashboardService";
import { AttentionDashboardService } from "../../../domains/analytics/application/AttentionDashboardService";
import { SalesDashboardService } from "../../../domains/analytics/application/SalesDashboardService";
import { DashboardScopeResolver, type SalesLineLookup } from "../../../domains/analytics/application/DashboardScopeResolver";
import type { TaskScheduler } from "../../../domains/scheduling/application/TaskScheduler";
import { MetaMarketingClient } from "../../../infrastructure/meta/MetaMarketingClient";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlAdsRepository } from "../../../infrastructure/persistence/sql/SqlAdsRepository";
import { SqlDashboardAds } from "../../../infrastructure/persistence/sql/SqlDashboardAds";
import { SqlDashboardAttention } from "../../../infrastructure/persistence/sql/SqlDashboardAttention";
import { SqlDashboardSales } from "../../../infrastructure/persistence/sql/SqlDashboardSales";
import { SqlFxRates } from "../../../infrastructure/persistence/sql/SqlFxRates";
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
  readonly sales: SalesDashboardService;
  readonly ads: AdsDashboardService;
  readonly attention: AttentionDashboardService;
}

export interface AdsModule {
  /** `null` sin llave de cifrado (desarrollo sin secretos). */
  readonly connection: AdConnectionServices | null;
  readonly syncHandler: AdsSyncTaskHandler | null;
  readonly dashboard: DashboardModule;
  /** Adonde vuelve la web al terminar el inicio de sesión de Meta. */
  readonly appOrigin: string;
}

export function composeAdsServices(
  config: ApiConfig,
  sql: SqlClient,
  scheduler: TaskScheduler,
  onError: (error: unknown, context: Record<string, unknown>) => void,
  /** Las líneas de venta, para filtrar el Dashboard por línea. */
  lines: SalesLineLookup | null = null
): AdsModule {
  const tenants = new SqlTenantResolver(sql, config.defaultTimezone);
  const timezoneOf = async (tenantId: string) => (await tenants.resolve(tenantId)).timezone;
  const fx = new SqlFxRates(sql);
  const adsReader = new SqlDashboardAds(sql);
  const scopes = new DashboardScopeResolver(lines);
  const dashboard: DashboardModule = {
    sales: new SalesDashboardService(new SqlDashboardSales(sql), adsReader, fx, timezoneOf, undefined, scopes),
    ads: new AdsDashboardService(adsReader, fx, timezoneOf, undefined, scopes),
    attention: new AttentionDashboardService(new SqlDashboardAttention(sql), fx, timezoneOf, undefined, scopes)
  };
  if (!config.credentialsKeyRing) return { connection: null, syncHandler: null, dashboard, appOrigin: config.publicAppOrigin };

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
    appOrigin: config.publicAppOrigin
  };
}
