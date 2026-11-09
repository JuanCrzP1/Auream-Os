import type { McpPermissions } from "../../../contracts/McpContracts";
import type { OAuthAuthorizeDecision, OAuthAuthorizeDecisionRequest, OAuthAuthorizeDescription, OAuthAuthorizeParams } from "../../../contracts/McpOAuthContracts";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { hashToken } from "../domain/McpCredential";
import {
  ACCESS_TOKEN_PREFIX,
  OAUTH_TTL,
  OAuthError,
  readAuthorizationRequest,
  readClientRegistration,
  redirectWith,
  REFRESH_TOKEN_PREFIX,
  verifyPkce,
  type AuthorizationRequest,
  type OAuthClient
} from "../domain/OAuth";
import type { McpCredentialServices } from "./McpCredentialServices";
import type { McpOAuthRepository } from "./McpOAuthRepository";

// ---------------------------------------------------------------------------
// OAuth 2.1 del servidor MCP — lo que hace que Claude (web y escritorio) se
// conecte pegando solo la dirección: el agente se registra, el usuario entra
// a Auream y autoriza con los permisos que elija, y el agente cambia el
// código por tokens que rotan.
//
//   register   registro dinámico del agente (RFC 7591), sin sesión
//   describe   qué agente pide acceso (para la pantalla de consentimiento)
//   decide     autorizar (credencial `oauth` + código) o rechazar
//   exchange   el endpoint de tokens: código + PKCE, o renovación con rotación
// ---------------------------------------------------------------------------

export interface McpOAuthDependencies {
  readonly repository: McpOAuthRepository;
  readonly credentials: McpCredentialServices;
  /** La dirección del servidor MCP (el único `resource` que se acepta). */
  readonly resourceUrl: string;
  readonly newId: () => string;
  /** 32 bytes aleatorios en base64url. */
  readonly newSecret: () => string;
  readonly now?: () => Date;
}

/** Respuesta del endpoint de tokens (RFC 6749 §5.1). */
export interface OAuthTokenResponse {
  readonly access_token: string;
  readonly token_type: "Bearer";
  readonly expires_in: number;
  readonly refresh_token: string;
}

const field = (form: Readonly<Record<string, unknown>>, name: string): string => (typeof form[name] === "string" ? (form[name] as string) : "");

export class McpOAuthServices {
  private readonly now: () => Date;

  public constructor(private readonly deps: McpOAuthDependencies) {
    this.now = deps.now ?? (() => new Date());
  }

  public async register(raw: unknown): Promise<Record<string, unknown>> {
    const { name, redirectUris } = readClientRegistration(raw);
    const now = this.now();
    const client: OAuthClient = { clientId: this.deps.newId(), name, redirectUris, createdAt: now.toISOString() };
    await this.deps.repository.createClient(client);
    return {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(now.getTime() / 1000),
      client_name: name,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none"
    };
  }

  public async describe(params: OAuthAuthorizeParams): Promise<OAuthAuthorizeDescription> {
    try {
      const { client, request } = await this.read(params);
      return { status: "ready", clientName: client.name, redirectHost: new URL(request.redirectUri).host };
    } catch (error) {
      if (!(error instanceof OAuthError)) throw error;
      const redirectTo = error.redirectable ? redirectWith(params["redirect_uri"]!, { error: error.code, error_description: error.message, state: params["state"] ?? null }) : null;
      return { status: "invalid", message: error.message, redirectTo };
    }
  }

  public async decide(tenantId: string, decision: OAuthAuthorizeDecisionRequest): Promise<OAuthAuthorizeDecision> {
    const { client, request } = await this.read(decision.params ?? {}).catch((error: unknown) => {
      throw error instanceof OAuthError ? new ValidationError(error.message) : error;
    });
    if (!decision.approve) {
      return { redirectTo: redirectWith(request.redirectUri, { error: "access_denied", error_description: "El usuario no autorizó el acceso.", state: request.state }) };
    }
    const credential = await this.deps.credentials.authorize(tenantId, { name: client.name, permissions: decision.permissions ?? ({} as McpPermissions), clientId: client.clientId });
    const code = this.deps.newSecret();
    await this.deps.repository.saveCode({
      codeHash: hashToken(code),
      clientId: client.clientId,
      credentialId: credential.id,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      resource: request.resource,
      expiresAt: new Date(this.now().getTime() + OAUTH_TTL.codeMs).toISOString()
    });
    return { redirectTo: redirectWith(request.redirectUri, { code, state: request.state }) };
  }

  /** El endpoint de tokens. Lanza `OAuthError` con el código estándar si algo no cuadra. */
  public async exchange(form: Readonly<Record<string, unknown>>): Promise<OAuthTokenResponse> {
    const grant = field(form, "grant_type");
    const resource = field(form, "resource").replace(/\/+$/, "");
    if (resource && resource !== this.deps.resourceUrl) throw new OAuthError("invalid_target", "Ese recurso no es el servidor MCP de Auream.");
    const now = this.now().getTime();

    if (grant === "authorization_code") {
      const code = await this.deps.repository.takeCode(hashToken(field(form, "code")));
      const valid =
        code !== null &&
        Date.parse(code.expiresAt) > now &&
        code.clientId === field(form, "client_id") &&
        code.redirectUri === field(form, "redirect_uri") &&
        verifyPkce(field(form, "code_verifier"), code.codeChallenge);
      if (!valid) throw new OAuthError("invalid_grant", "El código no es válido, ya se usó o venció.");
      return this.issue(code.credentialId, code.clientId);
    }
    if (grant === "refresh_token") {
      const current = await this.deps.repository.takeRefresh(hashToken(field(form, "refresh_token")));
      const clientId = field(form, "client_id");
      if (!current || Date.parse(current.refreshExpiresAt) <= now || (clientId && clientId !== current.clientId)) {
        throw new OAuthError("invalid_grant", "El token de renovación no es válido o venció. Vuelve a conectar el agente.");
      }
      return this.issue(current.credentialId, current.clientId);
    }
    throw new OAuthError("unsupported_grant_type", "Solo se admiten authorization_code y refresh_token.");
  }

  private async read(params: OAuthAuthorizeParams): Promise<{ client: OAuthClient; request: AuthorizationRequest }> {
    const clientId = params["client_id"] ?? "";
    const client = clientId ? await this.deps.repository.findClient(clientId) : null;
    return { client: client!, request: readAuthorizationRequest(params, client, this.deps.resourceUrl) };
  }

  private async issue(credentialId: string, clientId: string): Promise<OAuthTokenResponse> {
    const accessToken = `${ACCESS_TOKEN_PREFIX}${this.deps.newSecret()}`;
    const refreshToken = `${REFRESH_TOKEN_PREFIX}${this.deps.newSecret()}`;
    const now = this.now().getTime();
    await this.deps.repository.saveTokens({
      id: this.deps.newId(),
      credentialId,
      clientId,
      accessHash: hashToken(accessToken),
      accessExpiresAt: new Date(now + OAUTH_TTL.accessMs).toISOString(),
      refreshHash: hashToken(refreshToken),
      refreshExpiresAt: new Date(now + OAUTH_TTL.refreshMs).toISOString()
    });
    return { access_token: accessToken, token_type: "Bearer", expires_in: OAUTH_TTL.accessMs / 1000, refresh_token: refreshToken };
  }
}
