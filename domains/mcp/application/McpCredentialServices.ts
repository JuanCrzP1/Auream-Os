import { MCP_EXPIRY_OPTIONS, MCP_TOKEN_PREFIX, type CreateMcpCredentialRequest, type McpCredentialCreated, type McpCredentialSummary } from "../../../contracts/McpContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { hashToken, isExpired, requireCredentialName, requirePermissions, scopesOf, type McpAccess, type McpCredential } from "../domain/McpCredential";
import type { McpCredentialRepository } from "./McpCredentialRepository";

// ---------------------------------------------------------------------------
// Credenciales de los agentes de IA (MCP) de una cuenta: listarlas (sin el
// token), crearlas (el token se entrega UNA vez), revocarlas y validar el
// token con que se presenta un agente (vencida o revocada = no entra).
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
    if ((await this.deps.repository.list(tenantId)).length >= MAX_CREDENTIALS) throw new ValidationError(`Una cuenta puede tener hasta ${MAX_CREDENTIALS} credenciales. Revoca alguna que no uses.`);

    const token = `${MCP_TOKEN_PREFIX}${this.deps.newSecret()}`;
    const now = this.now();
    const credential: McpCredential = {
      id: this.deps.newId(),
      tenantId,
      name,
      permissions,
      tokenHash: hashToken(token),
      hint: `••••${token.slice(-4)}`,
      createdAt: now.toISOString(),
      lastUsedAt: null,
      expiresAt: days === null ? null : new Date(now.getTime() + days * 86_400_000).toISOString()
    };
    await this.deps.repository.create(credential);
    return { credential: toCredentialSummary(credential), token };
  }

  public async revoke(tenantId: string, id: string): Promise<void> {
    if (!(await this.deps.repository.remove(tenantId, id))) throw new NotFoundError("Esa credencial no existe.");
  }

  /** El acceso de un agente por su token, o `null` (no existe, otro formato, vencida). */
  public async authenticate(token: string): Promise<McpAccess | null> {
    if (!token.startsWith(MCP_TOKEN_PREFIX)) return null;
    const credential = await this.deps.repository.findByHash(hashToken(token));
    const now = this.now();
    if (!credential || isExpired(credential, now)) return null;
    if (!credential.lastUsedAt || now.getTime() - Date.parse(credential.lastUsedAt) >= TOUCH_EVERY_MS) {
      await this.deps.repository.touch(credential.id, now.toISOString()).catch(() => undefined);
    }
    return { tenantId: credential.tenantId, credentialId: credential.id, credentialName: credential.name, scopes: scopesOf(credential.permissions) };
  }
}
