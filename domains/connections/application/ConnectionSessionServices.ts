import type { ConnectionSummary } from "../../../contracts/ConnectionContracts";
import type { SecretCipher } from "../../../platform/security/secrets/SecretCipher";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import type { WhatsAppConnection } from "../domain/WhatsAppConnection";
import type { ConnectionRepository } from "./ConnectionRepository";
import { requireConnection, sessionOf, toConnectionSummary, upstream } from "./connectionSession";
import type { ProviderSession, WhatsAppLinkers } from "./ports/WhatsAppLinker";

// ---------------------------------------------------------------------------
// Acciones sobre la sesión de un número ya vinculado, como en Leona:
//
//   desconectar  cierra la sesión de WhatsApp pero CONSERVA la conexión (sus
//                disparadores, sus chats y su sesión en el proveedor):
//                «Reconectar» muestra un QR nuevo y vuelve a quedar igual
//   reiniciar    retoma la conexión sin desvincular (cuando el número no
//                recibe o no envía); no pide QR
//
// Eliminar (borra la sesión en el proveedor y la conexión) es `DeleteConnectionService`.
// ---------------------------------------------------------------------------

interface SessionDependencies {
  readonly repository: ConnectionRepository;
  readonly linkers: WhatsAppLinkers;
  readonly cipher: SecretCipher;
  readonly now?: () => Date;
}

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
    await this.deps.linkers.for(connection.method).disconnect(session).catch(upstream);
    const at = (this.deps.now ?? (() => new Date()))().toISOString();
    const updated: WhatsAppConnection = { ...connection, status: "disconnected", updatedAt: at };
    await this.deps.repository.save(updated);
    return toConnectionSummary(updated);
  }
}

export class RestartConnectionService {
  public constructor(private readonly deps: SessionDependencies) {}

  public async execute(tenantId: string, id: string): Promise<ConnectionSummary> {
    const { connection, session } = await requireSession(this.deps, tenantId, id, ["connected"], "Solo se puede reiniciar un número conectado. Si está desconectado, usa «Reconectar».");
    await this.deps.linkers.for(connection.method).reset(session).catch(upstream);
    return toConnectionSummary(connection);
  }
}
