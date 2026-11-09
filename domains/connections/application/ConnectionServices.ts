import { randomUUID } from "node:crypto";
import type {
  ConnectionLinkState,
  ConnectionSummary,
  CreateConnectionRequest,
  UpdateConnectionRequest
} from "../../../contracts/ConnectionContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { isConnectionMethod, normalizeConnectionName, type WhatsAppConnection } from "../domain/WhatsAppConnection";
import type { ConnectionRepository } from "./ConnectionRepository";
import type { WhatsAppLinker } from "./ports/WhatsAppLinker";

// ---------------------------------------------------------------------------
// Casos de uso de las conexiones de WhatsApp. El tenant siempre sale del
// contexto autenticado; ninguna respuesta lleva la referencia del proveedor.
// ---------------------------------------------------------------------------

export function toConnectionSummary(connection: WhatsAppConnection): ConnectionSummary {
  return {
    id: connection.id,
    name: connection.name,
    method: connection.method,
    status: connection.status,
    phoneNumber: connection.phoneNumber,
    profileName: connection.profileName,
    lastConnectedAt: connection.lastConnectedAt,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt
  };
}

async function requireConnection(repository: ConnectionRepository, tenantId: string, id: string): Promise<WhatsAppConnection> {
  const connection = await repository.findById(tenantId, id);
  if (!connection) throw new NotFoundError("Conexión no encontrada.");
  return connection;
}

const NAME_RULE = "Ponle un nombre de 1 a 40 caracteres (p. ej. «Ventas Colombia»).";

export class ListConnectionsService {
  public constructor(private readonly repository: ConnectionRepository) {}

  public async execute(tenantId: string): Promise<ConnectionSummary[]> {
    return (await this.repository.listByTenant(tenantId)).map(toConnectionSummary);
  }
}

export class CreateConnectionService {
  public constructor(
    private readonly repository: ConnectionRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async execute(tenantId: string, input: Partial<CreateConnectionRequest>): Promise<ConnectionSummary> {
    if (!isConnectionMethod(input.method)) throw new ValidationError("Elige cómo conectar el número: código QR o API oficial.");
    const name = normalizeConnectionName(input.name);
    if (!name) throw new ValidationError(NAME_RULE);

    const at = this.now().toISOString();
    const connection: WhatsAppConnection = {
      id: randomUUID(),
      tenantId,
      name,
      method: input.method,
      status: "pending",
      phoneNumber: null,
      profileName: null,
      providerRef: null,
      lastConnectedAt: null,
      createdAt: at,
      updatedAt: at
    };
    await this.repository.save(connection);
    return toConnectionSummary(connection);
  }
}

export class RenameConnectionService {
  public constructor(
    private readonly repository: ConnectionRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async execute(tenantId: string, id: string, input: Partial<UpdateConnectionRequest>): Promise<ConnectionSummary> {
    const name = normalizeConnectionName(input.name);
    if (!name) throw new ValidationError(NAME_RULE);
    const connection = await requireConnection(this.repository, tenantId, id);
    const renamed: WhatsAppConnection = { ...connection, name, updatedAt: this.now().toISOString() };
    await this.repository.save(renamed);
    return toConnectionSummary(renamed);
  }
}

export class DeleteConnectionService {
  public constructor(
    private readonly repository: ConnectionRepository,
    private readonly linker: WhatsAppLinker
  ) {}

  /** Cierra la sesión en el proveedor y borra la conexión. */
  public async execute(tenantId: string, id: string): Promise<void> {
    const connection = await requireConnection(this.repository, tenantId, id);
    await this.linker.unlink(connection);
    await this.repository.delete(tenantId, id);
  }
}

/**
 * Vincular (o reconectar) un número: pide al proveedor un QR o completa la
 * conexión, y deja el estado como corresponde.
 */
export class LinkConnectionService {
  public constructor(
    private readonly repository: ConnectionRepository,
    private readonly linker: WhatsAppLinker,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async execute(tenantId: string, id: string): Promise<ConnectionLinkState> {
    const connection = await requireConnection(this.repository, tenantId, id);
    if (connection.status === "connected") return { state: "connected", connection: toConnectionSummary(connection) };

    const outcome = await this.linker.link(connection);
    const at = this.now().toISOString();

    if (outcome.kind === "unavailable") {
      return { state: "unavailable", reason: "provider_not_configured", message: outcome.message, connection: toConnectionSummary(connection) };
    }
    if (outcome.kind === "qr") {
      const waiting: WhatsAppConnection = { ...connection, status: "connecting", providerRef: outcome.providerRef, updatedAt: at };
      await this.repository.save(waiting);
      return { state: "qr", qrImage: outcome.qrImage, expiresAt: outcome.expiresAt, connection: toConnectionSummary(waiting) };
    }
    const linked: WhatsAppConnection = {
      ...connection,
      status: "connected",
      phoneNumber: outcome.phoneNumber,
      profileName: outcome.profileName,
      providerRef: outcome.providerRef,
      lastConnectedAt: at,
      updatedAt: at
    };
    await this.repository.save(linked);
    return { state: "connected", connection: toConnectionSummary(linked) };
  }
}
