import type { ConnectionLinkState, ConnectionStatus, ConnectionSummary } from "../../../contracts/ConnectionContracts";
import type { SecretCipher } from "../../../platform/security/secrets/SecretCipher";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { UpstreamError } from "../../../platform/observability/errors/UpstreamError";
import { connectionSecretContext, type WhatsAppConnection } from "../domain/WhatsAppConnection";
import type { ConnectionRepository } from "./ConnectionRepository";
import { LinkerError, type ProviderSession, type SessionState } from "./ports/WhatsAppLinker";

// ---------------------------------------------------------------------------
// Piezas compartidas por los casos de uso de una conexión: buscarla en la
// cuenta, su sesión del proveedor (descifrada), aplicar lo que dice el
// proveedor y traducir sus fallas. Sin estado propio.
// ---------------------------------------------------------------------------

export function toConnectionSummary(connection: WhatsAppConnection, triggerCount = 0): ConnectionSummary {
  return {
    id: connection.id,
    name: connection.name,
    method: connection.method,
    status: connection.status,
    phoneNumber: connection.phoneNumber,
    profileName: connection.profileName,
    profilePictureUrl: connection.profilePictureUrl,
    lastConnectedAt: connection.lastConnectedAt,
    triggerCount,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt
  };
}

export async function requireConnection(repository: ConnectionRepository, tenantId: string, id: string): Promise<WhatsAppConnection> {
  const connection = await repository.findById(tenantId, id);
  if (!connection) throw new NotFoundError("Conexión no encontrada.");
  return connection;
}

/** La sesión del proveedor, descifrada. `null` si aún no hay. */
export function sessionOf(connection: WhatsAppConnection, cipher: SecretCipher): ProviderSession | null {
  if (!connection.providerRef || !connection.providerSecret) return null;
  return { ref: connection.providerRef, secret: cipher.decrypt(connection.providerSecret, connectionSecretContext(connection.tenantId, connection.id)) };
}

export function withSession(connection: WhatsAppConnection, session: ProviderSession, cipher: SecretCipher): WhatsAppConnection {
  return {
    ...connection,
    providerRef: session.ref,
    providerSecret: cipher.encrypt(session.secret, connectionSecretContext(connection.tenantId, connection.id))
  };
}

/** Aplica lo que dice el proveedor a la conexión. */
export function applyState(connection: WhatsAppConnection, state: SessionState, at: string): WhatsAppConnection {
  if (state.kind === "connected") {
    return {
      ...connection,
      status: "connected",
      phoneNumber: state.phoneNumber,
      profileName: state.profileName,
      // La foto es un enlace temporal: si el proveedor no la trae, se conserva la anterior.
      profilePictureUrl: state.profilePictureUrl ?? connection.profilePictureUrl,
      lastConnectedAt: connection.status === "connected" && connection.lastConnectedAt ? connection.lastConnectedAt : at,
      updatedAt: at
    };
  }
  if (state.kind === "qr") return { ...connection, status: "connecting", updatedAt: at };
  // Sin sesión: si estuvo conectada, se cayó; si no, sigue por vincular.
  const status: ConnectionStatus = connection.status === "connected" || connection.status === "disconnected" ? "disconnected" : "pending";
  return { ...connection, status, updatedAt: at };
}

export function toLinkState(connection: WhatsAppConnection, state: SessionState): ConnectionLinkState {
  const summary = toConnectionSummary(connection);
  if (state.kind === "qr") return { state: "qr", qrImage: state.qrImage, connection: summary };
  if (state.kind === "connected") return { state: "connected", connection: summary };
  return { state: "disconnected", connection: summary };
}

export function upstream(error: unknown): never {
  if (error instanceof LinkerError) throw new UpstreamError(`El proveedor de WhatsApp falló: ${error.message}`);
  throw error;
}

