import type { AdsAccountsResponse, MetaOAuthStartResponse } from "../../../contracts/AdsContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { isActiveAccount, needsReconnect, type AdAccount } from "../domain/AdAccount";
import { AdsProviderError, type AdsProvider, type AdsRepository, type AdsSyncScheduler, type TokenCipher } from "./AdsPorts";
import type { OAuthStateSigner } from "./OAuthState";

// ---------------------------------------------------------------------------
// La conexión con Meta: verla, conectar (inicio de sesión de Meta o un token
// de usuario del sistema), elegir qué cuentas publicitarias sincroniza Auream,
// sincronizar ya y desconectar. El token se guarda cifrado y nunca sale.
// ---------------------------------------------------------------------------

export interface AdsActor {
  readonly tenantId: string;
  readonly userId: string;
  readonly canManage: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Entre una sincronización a mano y otra. */
const MANUAL_SYNC_GAP_MS = 5 * 60_000;

export const tokenContext = (tenantId: string) => `${tenantId}:meta`;

export class AdConnectionServices {
  public constructor(
    private readonly repository: AdsRepository,
    private readonly provider: AdsProvider,
    private readonly cipher: TokenCipher,
    private readonly scheduler: AdsSyncScheduler,
    private readonly signer: OAuthStateSigner | null,
    private readonly redirectUri: string,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async status(actor: AdsActor): Promise<AdsAccountsResponse> {
    const [connection, accounts] = await Promise.all([this.repository.connection(actor.tenantId), this.repository.accounts(actor.tenantId)]);
    return {
      connection: {
        connected: connection !== null,
        method: connection?.method ?? null,
        userName: connection?.metaUserName ?? null,
        expiresAt: connection?.expiresAt ?? null,
        needsReconnect: connection ? needsReconnect(connection.expiresAt, this.now()) || Boolean(connection.lastError) : false,
        lastError: connection?.lastError ?? null
      },
      accounts: accounts.map(toSummary),
      canManage: actor.canManage,
      oauthAvailable: this.signer !== null && this.provider.authorizeUrl("probe", this.redirectUri) !== null
    };
  }

  public startOAuth(actor: AdsActor): MetaOAuthStartResponse {
    const url = this.signer ? this.provider.authorizeUrl(this.signer.sign({ tenantId: actor.tenantId, userId: actor.userId }), this.redirectUri) : null;
    if (!url) throw new ValidationError("Este servidor aún no tiene la app de Meta configurada. Conecta con un token por ahora.");
    return { url };
  }

  /** La vuelta del inicio de sesión de Meta. Devuelve la cuenta conectada. */
  public async completeOAuth(code: string, state: string): Promise<string> {
    const owner = this.signer?.verify(state) ?? null;
    if (!owner) throw new ValidationError("El inicio de sesión con Meta venció o no es válido. Inténtalo de nuevo.");
    if (!code) throw new ValidationError("Meta no autorizó la conexión.");
    const { token, expiresAt } = await this.provider.exchangeCode(code, this.redirectUri);
    await this.connect(owner.tenantId, owner.userId, token, expiresAt, "oauth");
    return owner.tenantId;
  }

  public async connectWithToken(actor: AdsActor, accessToken: unknown): Promise<AdsAccountsResponse> {
    const token = typeof accessToken === "string" ? accessToken.trim() : "";
    if (token.length < 20 || /\s/.test(token)) throw new ValidationError("Pega el token completo de Meta.");
    await this.connect(actor.tenantId, actor.userId, token, await this.provider.tokenExpiry(token), "token");
    return this.status(actor);
  }

  public async setEnabled(actor: AdsActor, accountId: string, enabled: boolean): Promise<AdsAccountsResponse> {
    const account = UUID.test(accountId) ? await this.repository.setEnabled(actor.tenantId, accountId, enabled) : null;
    if (!account) throw new NotFoundError("Esa cuenta publicitaria no existe.");
    if (enabled) await this.scheduler.scheduleSync(actor.tenantId, account.id, this.now());
    return this.status(actor);
  }

  public async syncNow(actor: AdsActor, accountId: string): Promise<void> {
    const account = UUID.test(accountId) ? await this.repository.account(actor.tenantId, accountId) : null;
    if (!account) throw new NotFoundError("Esa cuenta publicitaria no existe.");
    if (!account.enabled) throw new ValidationError("Primero elige esta cuenta para que Auream la use.");
    if (account.lastSyncedAt && this.now().getTime() - new Date(account.lastSyncedAt).getTime() < MANUAL_SYNC_GAP_MS) {
      throw new ValidationError("Se actualizó hace menos de 5 minutos. Espera un momento.");
    }
    await this.scheduler.scheduleSync(actor.tenantId, account.id, this.now());
  }

  public async disconnect(actor: AdsActor): Promise<void> {
    await this.repository.removeConnection(actor.tenantId);
  }

  private async connect(tenantId: string, userId: string, token: string, expiresAt: string | null, method: "oauth" | "token"): Promise<void> {
    // Primero las cuentas publicitarias: es lo único que Auream necesita. El
    // nombre de quien conecta es un adorno; si Meta no lo da, queda «Meta».
    let accounts;
    try {
      accounts = await this.provider.listAccounts(token);
    } catch (error) {
      if (error instanceof AdsProviderError) throw new ValidationError(explain(error, method));
      throw error;
    }
    const user = await this.provider.me(token).catch((error: unknown) => {
      if (error instanceof AdsProviderError && error.reason !== "token") return { id: null, name: "Meta" };
      throw error instanceof AdsProviderError ? new ValidationError(explain(error, method)) : error;
    });
    if (accounts.length === 0) throw new ValidationError(method === "token" ? TOKEN_WITHOUT_ACCOUNTS : "Ese usuario de Meta no tiene cuentas publicitarias (o no aceptó el permiso ads_read).");
    await this.repository.saveConnection({
      tenantId,
      method,
      tokenCiphertext: this.cipher.encrypt(token, tokenContext(tenantId)),
      metaUserId: user.id,
      metaUserName: user.name,
      connectedBy: userId,
      expiresAt,
      lastError: null
    });
    await this.repository.upsertAccounts(tenantId, accounts);
    // Con una sola cuenta activa no hay nada que elegir: se usa de una vez.
    const stored = await this.repository.accounts(tenantId);
    const active = stored.filter((account) => isActiveAccount(account.providerStatus));
    const toSync = active.length === 1 && !active[0]!.enabled ? [await this.repository.setEnabled(tenantId, active[0]!.id, true)] : stored.filter((account) => account.enabled);
    for (const account of toSync) if (account) await this.scheduler.scheduleSync(tenantId, account.id, this.now());
  }
}

/** Al pegar un token: qué está mal y cómo arreglarlo, y lo que dijo Meta para ver la causa real. */
const TOKEN_PROBLEMS: Readonly<Record<string, string>> = {
  token: "Meta no acepta ese token: puede estar mal copiado, vencido o revocado. Genera uno nuevo en tu Business Manager y pégalo completo.",
  permission: "Meta no dejó leer tus cuentas publicitarias con ese token. Revisa que tenga ads_read y que el usuario del sistema tenga asignada la cuenta publicitaria."
};
function explain(error: AdsProviderError, method: "oauth" | "token"): string {
  const advice = method === "token" ? (TOKEN_PROBLEMS[error.reason ?? ""] ?? error.message) : error.message;
  return error.detail ? `${advice} Meta dice: «${error.detail}».` : advice;
}
const TOKEN_WITHOUT_ACCOUNTS =
  "Ese token no ve ninguna cuenta publicitaria. En tu Business Manager, asígnale al usuario del sistema tu cuenta publicitaria (con permiso para ver el rendimiento) y vuelve a pegarlo.";

function toSummary(account: AdAccount) {
  return {
    id: account.id,
    externalId: account.externalId,
    name: account.name,
    currency: account.currency,
    timezone: account.timezone,
    active: isActiveAccount(account.providerStatus),
    enabled: account.enabled,
    lastSyncedAt: account.lastSyncedAt,
    lastError: account.lastError
  };
}
