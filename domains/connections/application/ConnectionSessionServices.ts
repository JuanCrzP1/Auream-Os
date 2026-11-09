import type { ConnectionSummary } from "../../../contracts/ConnectionContracts";
import type { SecretCipher } from "../../../platform/security/secrets/SecretCipher";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import type { WhatsAppConnection } from "../domain/WhatsAppConnection";
import type { ConnectionRepository } from "./ConnectionRepository";
import { requireConnection, sessionOf, toConnectionSummary, upstream } from "./connectionSession";
import { SessionGoneError, type ProviderSession, type WhatsAppLinkers } from "./ports/WhatsAppLinker";

// ---------------------------------------------------------------------------
// Acciones sobre la sesión de un número ya vinculado, como en Leona:
//
//   desconectar  cierra la sesión de WhatsApp pero CONSERVA la conexión (sus
//                disparadores, sus chats y su sesión en el proveedor):
//                «Reconectar» muestra un QR nuevo y vuelve a quedar igual
//   reiniciar    retoma la conexión sin desvincular (cuando el número no
//                recibe o no envía); no pide QR
//
// Si el proveedor ya no tiene la sesión (la borró o venció), el número queda
// DESCONECTADO en Auream: desconectar cumple su objetivo y reiniciar lo
// informa (se ve «Reconectar»). Nunca queda atascado en «Conectada».
//
// Eliminar (borra la sesión en el proveedor y la conexión) es `DeleteConnectionService`.
// ---------------------------------------------------------------------------

interface SessionDependencies {
  readonly repository: ConnectionRepository;
  readonly linkers: WhatsAppLinkers;
  readonly cipher: SecretCipher;
  readonly now?: () => Date;
}

/** La conexión pasa a desconectada (la sesión se conserva: reconectar la reutiliza o crea otra). */
async function markDisconnected(deps: SessionDependencies, connection: WhatsAppConnection): Promise<WhatsAppConnection> {
  const updated: WhatsAppConnection = { ...connection, status: "disconnected", updatedAt: (deps.now ?? (() => new Date()))().toISOString() };
  await deps.repository.save(updated);
  return updated;
}

const goneIsFine = (error: unknown): void => {
  if (!(error instanceof SessionGoneError)) upstream(error);
};

async function requireSession(deps: SessionDependencies, tenantId: string, id: string, allowed: ReadonlyArray<WhatsAppConnection["status"]>, message: string): Promise<{ connection: WhatsAppConnection; session: ProviderSession }> {
  const connection = await requireConnection(deps.repository, tenantId, id);
  const session = sessionOf(connection, deps.cipher);
  if (!session || !allowed.includes(connection.status)) throw new ValidationError(message);
  return { connection, session };
}

export class DisconnectConnectionService {
  public constructor(private readonly deps: SessionDependencies) {}

  public async execute(tenantId: string, id: string): Promise<ConnectionSummary> {
    const { connection, session } = await requireSession(this.deps, tenantId, id, ["connected", "connecting"], "Esta conexión no está vinculada: no hay nada que desconectar.");
    await this.deps.linkers.for(connection.method).disconnect(session).catch(goneIsFine);
    return toConnectionSummary(await markDisconnected(this.deps, connection));
  }
}

export class RestartConnectionService {
  public constructor(private readonly deps: SessionDependencies) {}

  public async execute(tenantId: string, id: string): Promise<ConnectionSummary> {
    const { connection, session } = await requireSession(this.deps, tenantId, id, ["connected"], "Solo se puede reiniciar un número conectado. Si está desconectado, usa «Reconectar».");
    try {
      await this.deps.linkers.for(connection.method).reset(session);
    } catch (error) {
      if (!(error instanceof SessionGoneError)) return upstream(error);
      // La sesión ya no existe: no hay qué reiniciar; queda desconectada (se ve «Reconectar»).
      return toConnectionSummary(await markDisconnected(this.deps, connection));
    }
    return toConnectionSummary(connection);
  }
}
