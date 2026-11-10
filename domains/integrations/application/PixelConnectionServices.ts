import { randomUUID } from "node:crypto";
import type { CreatePixelConnectionRequest, PixelConnectionSummary, UpdatePixelConnectionRequest } from "../../../contracts/PixelContracts";
import type { SecretCipher } from "../../../platform/security/secrets/SecretCipher";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import {
  normalizeAccessToken,
  normalizePixelId,
  normalizePixelName,
  pixelSecretContext,
  tokenHint,
  type PixelConnection
} from "../domain/PixelConnection";
import type { PixelConnectionRepository } from "./PixelConnectionRepository";
import type { MetaPixelAccess } from "./ports/MetaPixelAccess";
import { revealSecret } from "./revealSecret";

// ---------------------------------------------------------------------------
// Casos de uso de los píxeles de Meta. Ningún token se guarda sin que Meta
// confirme que da acceso a ese píxel, y ninguno sale de aquí en claro.
// ---------------------------------------------------------------------------

export function toPixelConnectionSummary(connection: PixelConnection): PixelConnectionSummary {
  return {
    id: connection.id,
    name: connection.name,
    pixelId: connection.pixelId,
    tokenHint: connection.tokenHint,
    status: connection.status,
    lastVerifiedAt: connection.lastVerifiedAt,
    createdAt: connection.createdAt
  };
}

async function requireConnection(repository: PixelConnectionRepository, tenantId: string, id: string): Promise<PixelConnection> {
  const connection = await repository.findById(tenantId, id);
  if (!connection) throw new NotFoundError("Píxel no encontrado.");
  return connection;
}

async function verifyOrFail(access: MetaPixelAccess, pixelId: string, token: string): Promise<void> {
  const check = await access.verifyPixel(pixelId, token);
  if (check.ok) return;
  throw new ValidationError(
    check.reason === "invalid_token"
      ? "Meta rechazó el token. Genera uno nuevo en el Administrador de eventos (Configuración → API de Conversiones)."
      : check.reason === "pixel_not_found"
        ? "Ese token no tiene acceso a ese píxel. Revisa el ID del conjunto de datos."
        : `No se pudo comprobar con Meta: ${check.message}`
  );
}

export class ListPixelConnectionsService {
  public constructor(private readonly repository: PixelConnectionRepository) {}

  public async execute(tenantId: string): Promise<PixelConnectionSummary[]> {
    return (await this.repository.listByTenant(tenantId)).map(toPixelConnectionSummary);
  }
}

export class CreatePixelConnectionService {
  public constructor(
    private readonly repository: PixelConnectionRepository,
    private readonly cipher: SecretCipher,
    private readonly access: MetaPixelAccess,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async execute(tenantId: string, input: Partial<CreatePixelConnectionRequest>): Promise<PixelConnectionSummary> {
    const pixelId = normalizePixelId(input.pixelId);
    if (!pixelId) throw new ValidationError("El ID del píxel son solo números (lo ves en el Administrador de eventos).");
    const token = normalizeAccessToken(input.accessToken);
    if (!token) throw new ValidationError("El token no parece válido: cópialo completo, sin espacios.");
    const name = normalizePixelName(input.name ?? `Píxel ${pixelId.slice(-4)}`);
    if (!name) throw new ValidationError("Ponle un nombre de 1 a 60 caracteres.");

    // Una cuenta puede tener muchos píxeles, pero cada uno una sola vez: dos
    // conexiones del mismo píxel duplicarían sus conversiones. Para un token
    // nuevo está «Cambiar token». Se revisa antes de molestar a Meta.
    const existing = (await this.repository.listByTenant(tenantId)).find((connection) => connection.pixelId === pixelId);
    if (existing) {
      throw new ConflictError(`Ese píxel ya está conectado como «${existing.name}». Si necesitas otro token, usa «Cambiar token» en su tarjeta.`);
    }

    await verifyOrFail(this.access, pixelId, token);

    const id = randomUUID();
    const at = this.now().toISOString();
    const connection: PixelConnection = {
      id,
      tenantId,
      name,
      pixelId,
      secret: this.cipher.encrypt(token, pixelSecretContext(tenantId, id)),
      tokenHint: tokenHint(token),
      status: "active",
      lastVerifiedAt: at,
      createdAt: at,
      updatedAt: at
    };
    await this.repository.save(connection);
    return toPixelConnectionSummary(connection);
  }
}

export class UpdatePixelConnectionService {
  public constructor(
    private readonly repository: PixelConnectionRepository,
    private readonly cipher: SecretCipher,
    private readonly access: MetaPixelAccess,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async execute(tenantId: string, id: string, input: Partial<UpdatePixelConnectionRequest>): Promise<PixelConnectionSummary> {
    const current = await requireConnection(this.repository, tenantId, id);
    let next = current;
    const at = this.now().toISOString();

    if (input.name !== undefined) {
      const name = normalizePixelName(input.name);
      if (!name) throw new ValidationError("Ponle un nombre de 1 a 60 caracteres.");
      next = { ...next, name };
    }
    if (input.accessToken !== undefined) {
      const token = normalizeAccessToken(input.accessToken);
      if (!token) throw new ValidationError("El token no parece válido: cópialo completo, sin espacios.");
      await verifyOrFail(this.access, current.pixelId, token);
      next = { ...next, secret: this.cipher.encrypt(token, pixelSecretContext(tenantId, id)), tokenHint: tokenHint(token), status: "active", lastVerifiedAt: at };
    }
    if (next === current) return toPixelConnectionSummary(current);

    next = { ...next, updatedAt: at };
    await this.repository.save(next);
    return toPixelConnectionSummary(next);
  }
}

export class DeletePixelConnectionService {
  public constructor(private readonly repository: PixelConnectionRepository) {}

  public async execute(tenantId: string, id: string): Promise<void> {
    if (!(await this.repository.delete(tenantId, id))) throw new NotFoundError("Píxel no encontrado.");
  }
}

/** Vuelve a comprobar el token guardado con Meta y actualiza el estado. */
export class VerifyPixelConnectionService {
  public constructor(
    private readonly repository: PixelConnectionRepository,
    private readonly cipher: SecretCipher,
    private readonly access: MetaPixelAccess,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async execute(tenantId: string, id: string): Promise<PixelConnectionSummary> {
    const current = await requireConnection(this.repository, tenantId, id);
    const token = revealSecret(this.cipher, current.secret, pixelSecretContext(tenantId, id), "el token de este píxel");
    const check = await this.access.verifyPixel(current.pixelId, token);
    if (!check.ok && check.reason === "unavailable") throw new ValidationError(`No se pudo comprobar con Meta ahora: ${check.message}`);

    const at = this.now().toISOString();
    const next: PixelConnection = { ...current, status: check.ok ? "active" : "invalid", lastVerifiedAt: at, updatedAt: at };
    await this.repository.save(next);
    return toPixelConnectionSummary(next);
  }
}
