import { createHmac } from "node:crypto";
import { AdsProviderError, type AdsProvider } from "../../domains/ads/application/AdsPorts";
import type { AdDailyInsight, AdEntity, ProviderAdAccount } from "../../domains/ads/domain/AdAccount";
import type { FetchLike } from "./MetaConversionsClient";
import { parseEntity, parseInsight } from "./metaInsights";

// ---------------------------------------------------------------------------
// MetaMarketingClient — la Marketing API de Meta para Meta Ads.
//
//   Inicio de sesión  /dialog/oauth → /oauth/access_token (y de larga duración)
//   Cuentas           /me/adaccounts
//   Catálogo          /act_x/campaigns · /adsets · /ads
//   Métricas          /act_x/insights?level=ad&time_increment=1
//
// El token viaja en la cabecera `Authorization` (las URLs acaban en
// registros), con `appsecret_proof` si hay secreto de la app. Sigue las
// páginas de Meta y nunca deja un token en un mensaje de error.
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 20_000;
const MAX_PAGES = 40;
export interface MetaAppCredentials {
  readonly appId: string;
  readonly appSecret: string;
  /**
   * La configuración de «Facebook Login for Business» (apps de tipo Negocio):
   * define en Meta el tipo de token, las cuentas y los permisos (solo
   * ads_read). El enlace lleva `config_id` y nunca `scope` (Meta pide no
   * mezclarlos). Sin ella no se ofrece el botón.
   */
  readonly loginConfigId?: string;
}

const scrub = (value: string) => value.replace(/\bEA[A-Za-z0-9]{20,}\b/g, "[token oculto]").slice(0, 240);

export class MetaMarketingClient implements AdsProvider {
  private readonly fetchImpl: FetchLike;

  public constructor(
    private readonly app: MetaAppCredentials | null,
    private readonly graphVersion = "v23.0",
    fetchImpl?: FetchLike,
    private readonly graphUrl = "https://graph.facebook.com",
    private readonly dialogUrl = "https://www.facebook.com"
  ) {
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init));
  }

  /**
   * El enlace de «Conectar con Meta», solo con la configuración del inicio de
   * sesión para empresas: es lo que enciende el botón. Sin ella (la app aún no
   * está aprobada), no hay botón aunque la app esté en el servidor: su secreto
   * igual sirve para los avisos de borrado de datos de Meta.
   */
  public authorizeUrl(state: string, redirectUri: string): string | null {
    if (!this.app?.loginConfigId) return null;
    const query = new URLSearchParams({
      client_id: this.app.appId,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      config_id: this.app.loginConfigId,
      override_default_response_type: "true"
    });
    return `${this.dialogUrl}/${this.graphVersion}/dialog/oauth?${query}`;
  }

  public async exchangeCode(code: string, redirectUri: string): Promise<{ token: string; expiresAt: string | null }> {
    if (!this.app) throw new AdsProviderError("La app de Meta no está configurada en el servidor.");
    const short = await this.request("oauth/access_token", null, { client_id: this.app.appId, client_secret: this.app.appSecret, redirect_uri: redirectUri, code });
    // La configuración «Conectar Meta Ads» entrega un token de usuario del sistema
    // que no vence: se usa tal cual (no hay que «alargarlo»).
    const token = String(short["access_token"] ?? "");
    if (!token) throw new AdsProviderError("Meta no entregó el permiso. Inténtalo de nuevo.");
    const seconds = Number(short["expires_in"] ?? 0);
    return { token, expiresAt: seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null };
  }

  public async me(token: string) {
    const body = await this.request("me", token, { fields: "id,name" });
    return { id: String(body["id"] ?? ""), name: String(body["name"] ?? "Meta") };
  }

  public async tokenExpiry(token: string): Promise<string | null> {
    if (!this.app) return null;
    const body = await this.request("debug_token", `${this.app.appId}|${this.app.appSecret}`, { input_token: token }).catch(() => null);
    const expires = Number(((body?.["data"] ?? {}) as Record<string, unknown>)["expires_at"] ?? 0);
    return expires > 0 ? new Date(expires * 1000).toISOString() : null;
  }

  public async listAccounts(token: string): Promise<ReadonlyArray<ProviderAdAccount>> {
    const rows = await this.pages("me/adaccounts", token, { fields: "id,name,currency,timezone_name,account_status", limit: "200" });
    return rows.map((row) => ({
      externalId: String(row["id"]),
      name: String(row["name"] ?? row["id"]),
      currency: String(row["currency"] ?? "USD").toUpperCase(),
      timezone: String(row["timezone_name"] ?? "UTC"),
      providerStatus: typeof row["account_status"] === "number" ? (row["account_status"] as number) : null
    }));
  }

  public async entities(token: string, account: string): Promise<ReadonlyArray<AdEntity>> {
    const currency = String((await this.request(account, token, { fields: "currency" }))["currency"] ?? "USD");
    const [campaigns, adsets, ads] = await Promise.all([
      this.pages(`${account}/campaigns`, token, { fields: "id,name,effective_status,daily_budget", limit: "500" }),
      this.pages(`${account}/adsets`, token, { fields: "id,name,campaign_id,effective_status,daily_budget", limit: "500" }),
      this.pages(`${account}/ads`, token, { fields: "id,name,adset_id,campaign_id,effective_status,creative{thumbnail_url}", limit: "500" })
    ]);
    return [
      ...campaigns.map((row) => parseEntity(row, "campaign", currency)),
      ...adsets.map((row) => parseEntity(row, "adset", currency)),
      ...ads.map((row) => parseEntity(row, "ad", currency))
    ].filter((entity): entity is AdEntity => entity !== null);
  }

  public async insights(token: string, account: string, since: string, until: string): Promise<ReadonlyArray<AdDailyInsight>> {
    const rows = await this.pages(`${account}/insights`, token, {
      level: "ad",
      time_increment: "1",
      time_range: JSON.stringify({ since, until }),
      fields: "ad_id,date_start,spend,impressions,clicks,actions,action_values",
      limit: "500"
    });
    return rows.map(parseInsight).filter((row): row is AdDailyInsight => row !== null);
  }

  /** Todas las páginas (hasta un tope prudente). */
  private async pages(path: string, token: string, query: Record<string, string>): Promise<Array<Record<string, unknown>>> {
    const rows: Array<Record<string, unknown>> = [];
    let after: string | null = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const body = await this.request(path, token, after ? { ...query, after } : query);
      rows.push(...((body["data"] as Array<Record<string, unknown>> | undefined) ?? []));
      const paging = (body["paging"] ?? {}) as { next?: string; cursors?: { after?: string } };
      after = paging.next && paging.cursors?.after ? paging.cursors.after : null;
      if (!after) break;
    }
    return rows;
  }

  private async request(path: string, token: string | null, query: Record<string, string>, sign = true): Promise<Record<string, unknown>> {
    const params = new URLSearchParams(query);
    const signed = sign && Boolean(token && this.app && !token.includes("|"));
    if (signed) params.set("appsecret_proof", createHmac("sha256", this.app!.appSecret).update(token!).digest("hex"));
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.graphUrl}/${this.graphVersion}/${path}?${params}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new AdsProviderError("No se pudo conectar con Meta. Se reintenta en la próxima vuelta.");
    }
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.ok) return body;
    const error = (body["error"] ?? {}) as MetaError;
    // Un token pegado de la app del propio cliente no se firma con el secreto de
    // Auream: Meta lo rechaza («appsecret_proof» inválido). Se repite sin firma.
    if (signed && error.code === 100 && /appsecret_proof/i.test(error.message ?? "")) return this.request(path, token, query, false);
    const detail = describe(error, response.status);
    if (error.code === 190 || response.status === 401) throw new AdsProviderError("Meta rechazó el permiso (venció o lo quitaron). Vuelve a conectar Meta Ads.", true, "token", detail);
    if (error.code === 200 || error.code === 10) throw new AdsProviderError("Meta no dio permiso para leer los anuncios. Vuelve a conectar y acéptalo.", true, "permission", detail);
    if (error.code === 4 || error.code === 17 || error.code === 613 || error.code === 80004) throw new AdsProviderError("Meta está limitando las consultas; se reintenta más tarde.", false, null, detail);
    throw new AdsProviderError(`Meta respondió ${response.status}: ${scrub(error.error_user_msg || error.message || "error desconocido")}`, false, null, detail);
  }
}

interface MetaError {
  readonly code?: number;
  readonly error_subcode?: number;
  readonly message?: string;
  readonly error_user_msg?: string;
}

/** Lo que dijo Meta, tal cual y sin el token: «(#10) … · código 10/2069007». */
function describe(error: MetaError, status: number): string {
  const code = error.code === undefined ? `HTTP ${status}` : `código ${error.code}${error.error_subcode ? `/${error.error_subcode}` : ""}`;
  return `${scrub(error.error_user_msg || error.message || "sin mensaje")} · ${code}`;
}
