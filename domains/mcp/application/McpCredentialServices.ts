import { MCP_EXPIRY_OPTIONS, MCP_TOKEN_PREFIX, type CreateMcpCredentialRequest, type McpCredentialCreated, type McpCredentialSummary, type McpPermissions } from "../../../contracts/McpContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { hashToken, isExpired, requireCredentialName, requirePermissions, scopesOf, type McpAccess, type McpCredential } from "../domain/McpCredential";
import { ACCESS_TOKEN_PREFIX } from "../domain/OAuth";
import type { McpCredentialRepository } from "./McpCredentialRepository";

// ---------------------------------------------------------------------------
// Credenciales de los agentes de IA (MCP) de una cuenta: listarlas (sin el
// token), crearlas (el token se entrega UNA vez), registrar las que autoriza
// un agente por OAuth, revocarlas y validar el token con que se presenta un
// agente: el fijo o uno de acceso OAuth (vencida o revocada = no entra).
// ---------------------------------------------------------------------------

/** El último uso se anota a lo sumo una vez por minuto (no una escritura por llamada). */
const TOUCH_EVERY_MS = 60_000;
const MAX_CREDENTIALS = 20;

export interface McpCredentialDependencies {
  readonly repository: McpCredentialRepository;
  readonly newId: () => string;
  /** 32 bytes aleatorios en base64url (el token es `aur_mcp_` + esto). */
  readonly newSecret: () => string;
  readonly now?: () => Date;
}

export function toCredentialSummary(credential: McpCredential): McpCredentialSummary {
  return {
    id: credential.id,
    kind: credential.kind,
    name: credential.name,
    permissions: credential.permissions,
    hint: credential.hint,
    createdAt: credential.createdAt,
    lastUsedAt: credential.lastUsedAt,
    expiresAt: credential.expiresAt
  };
}

export class McpCredentialServices {
  private readonly now: () => Date;

  public constructor(private readonly deps: McpCredentialDependencies) {
    this.now = deps.now ?? (() => new Date());
  }

  public async list(tenantId: string): Promise<McpCredentialSummary[]> {
    return (await this.deps.repository.list(tenantId)).map(toCredentialSummary);
  }

  public async create(tenantId: string, request: CreateMcpCredentialRequest): Promise<McpCredentialCreated> {
    const name = requireCredentialName(request.name);
    const permissions = requirePermissions(request.permissions);
    const days = request.expiresInDays ?? null;
    if (!MCP_EXPIRY_OPTIONS.includes(days)) throw new ValidationError("Elige un vencimiento válido.");
    await this.requireRoom(tenantId);

    const token = `${MCP_TOKEN_PREFIX}${this.deps.newSecret()}`;
    const now = this.now();
    const credential: McpCredential = {
      id: this.deps.newId(),
      tenantId,
      kind: "token",
      name,
      permissions,
      tokenHash: hashToken(token),
      clientId: null,
      hint: `••••${token.slice(-4)}`,
      createdAt: now.toISOString(),
      lastUsedAt: null,
      expiresAt: days === null ? null : new Date(now.getTime() + days * 86_400_000).toISOString()
    };
    await this.deps.repository.create(credential);
    return { credential: toCredentialSummary(credential), token };
  }

  /**
   * La credencial que nace cuando el usuario autoriza a un agente por OAuth,
   * con los permisos que eligió. Si ese mismo agente ya estaba autorizado en
   * la cuenta, la anterior se reemplaza (no se acumulan «Claude» repetidos).
   */
  public async authorize(tenantId: string, request: { readonly name: string; readonly permissions: McpPermissions; readonly clientId: string }): Promise<McpCredential> {
    const permissions = requirePermissions(request.permissions);
    await this.deps.repository.removeByClient(tenantId, request.clientId);
    await this.requireRoom(tenantId);
    const credential: McpCredential = {
      id: this.deps.newId(),
      tenantId,
      kind: "oauth",
      name: requireCredentialName(request.name),
      permissions,
      tokenHash: null,
      clientId: request.clientId,
      hint: "",
      createdAt: this.now().toISOString(),
      lastUsedAt: null,
      expiresAt: null
    };
    await this.deps.repository.create(credential);
    return credential;
  }

  public async revoke(tenantId: string, id: string): Promise<void> {
    if (!(await this.deps.repository.remove(tenantId, id))) throw new NotFoundError("Esa credencial no existe.");
  }

  /** El acceso de un agente por su token, o `null` (no existe, otro formato, vencida). */
  public async authenticate(token: string): Promise<McpAccess | null> {
    const now = this.now();
    const credential = token.startsWith(MCP_TOKEN_PREFIX)
      ? await this.deps.repository.findByHash(hashToken(token))
      : token.startsWith(ACCESS_TOKEN_PREFIX)
        ? await this.deps.repository.findByAccessHash(hashToken(token), now.toISOString())
        : null;
    if (!credential || isExpired(credential, now)) return null;
    if (!credential.lastUsedAt || now.getTime() - Date.parse(credential.lastUsedAt) >= TOUCH_EVERY_MS) {
      await this.deps.repository.touch(credential.id, now.toISOString()).catch(() => undefined);
    }
    return { tenantId: credential.tenantId, credentialId: credential.id, credentialName: credential.name, scopes: scopesOf(credential.permissions) };
  }

  private async requireRoom(tenantId: string): Promise<void> {
    if ((await this.deps.repository.list(tenantId)).length >= MAX_CREDENTIALS) throw new ValidationError(`Una cuenta puede tener hasta ${MAX_CREDENTIALS} credenciales. Revoca alguna que no uses.`);
  }
}
