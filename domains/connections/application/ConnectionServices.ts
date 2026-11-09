import { randomUUID, timingSafeEqual } from "node:crypto";
import type {
  ConnectionLinkState,
  ConnectionStatus,
  ConnectionSummary,
  CreateConnectionRequest,
  LinkConnectionRequest,
  UpdateConnectionRequest
} from "../../../contracts/ConnectionContracts";
import type { SecretCipher } from "../../../platform/security/secrets/SecretCipher";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import {
  isConnectionMethod,
  normalizeConnectionName,
  normalizePhoneNumber,
  type WhatsAppConnection
} from "../domain/WhatsAppConnection";
import type { ConnectionRepository } from "./ConnectionRepository";
import type { ConnectionTriggerRepository } from "./ConnectionTriggerRepository";
import { SessionGoneError, type ProviderSession, type SessionState, type WhatsAppLinkers } from "./ports/WhatsAppLinker";
import { applyState, requireConnection, sessionOf, toConnectionSummary, toLinkState, upstream, withSession } from "./connectionSession";

export { sessionOf, toConnectionSummary } from "./connectionSession";

// ---------------------------------------------------------------------------
// Casos de uso de las conexiones de WhatsApp. El tenant siempre sale del
// contexto autenticado. La credencial de la sesión en el proveedor se guarda
// cifrada y solo se descifra aquí, para entregársela al proveedor; ninguna
// respuesta la lleva.
// ---------------------------------------------------------------------------

const NAME_RULE = "Ponle un nombre de 1 a 40 caracteres (p. ej. «Ventas Colombia»).";

export class ListConnectionsService {
  public constructor(
    private readonly repository: ConnectionRepository,
    private readonly triggers?: Pick<ConnectionTriggerRepository, "countByConnection">
  ) {}

  public async execute(tenantId: string): Promise<ConnectionSummary[]> {
    const [connections, counts] = await Promise.all([
      this.repository.listByTenant(tenantId),
      this.triggers ? this.triggers.countByConnection(tenantId) : Promise.resolve(new Map<string, number>())
    ]);
    return connections.map((connection) => toConnectionSummary(connection, counts.get(connection.id) ?? 0));
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
      profilePictureUrl: null,
      providerRef: null,
      providerSecret: null,
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
    private readonly linkers: WhatsAppLinkers,
    private readonly cipher: SecretCipher
  ) {}

  /**
   * Borra la sesión en el proveedor y después la conexión. Si el proveedor
   * falla no se borra nada: quedaría una sesión huérfana (y cobrada) allá.
   */
  public async execute(tenantId: string, id: string): Promise<void> {
    const connection = await requireConnection(this.repository, tenantId, id);
    const session = sessionOf(connection, this.cipher);
    if (session) await this.linkers.for(connection.method).unlink(session).catch(upstream);
    await this.repository.delete(tenantId, id);
  }
}

/**
 * Vincular o reconectar un número: el proveedor da un QR o lo conecta. Con
 * `restart`, descarta el código en curso y empieza con uno nuevo.
 */
export class LinkConnectionService {
  public constructor(
    private readonly repository: ConnectionRepository,
    private readonly linkers: WhatsAppLinkers,
    private readonly cipher: SecretCipher,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async execute(tenantId: string, id: string, request: LinkConnectionRequest = {}): Promise<ConnectionLinkState> {
    let connection = await requireConnection(this.repository, tenantId, id);
    const session = sessionOf(connection, this.cipher);
    if (connection.status === "connected" && session) {
      // «Ver estado»: PRIMERO lo que dice el proveedor ahora (perfil, foto, si
      // sigue conectado). Si la sesión se cerró o ya no existe (el servidor
      // gratuito de uazapi borra instancias sin avisar), pasa a desconectada y
      // sigue abajo a vincular: sale el QR, sin quedar atascada en «Conectada».
      const linker = this.linkers.for(connection.method);
      const state = await linker.check(session).catch(upstream);
      const updated = applyState(connection, state, this.now().toISOString());
      if (updated.status !== connection.status || updated.profileName !== connection.profileName || updated.profilePictureUrl !== connection.profilePictureUrl) {
        await this.repository.save(updated);
      }
      if (state.kind === "connected") {
        // Sigue conectado: avisos del proveedor al día (versiones nuevas de Auream).
        await linker.refresh(session).catch((error: unknown) => (error instanceof SessionGoneError ? undefined : upstream(error)));
        return toLinkState(updated, state);
      }
      connection = updated;
    }
    if (connection.status === "connected") return { state: "connected", connection: toConnectionSummary(connection) };

    if (request.restart === true && session && connection.status === "connecting") {
      const state = await this.linkers.for(connection.method).restart(session).catch(upstream);
      const updated = applyState(connection, state, this.now().toISOString());
      await this.repository.save(updated);
      return toLinkState(updated, state);
    }

    const outcome = await this.linkers
      .for(connection.method)
      .start({ id: connection.id, tenantId, name: connection.name, method: connection.method }, session)
      .catch(upstream);

    if (outcome.kind === "unavailable") {
      return { state: "unavailable", reason: "provider_not_configured", message: outcome.message, connection: toConnectionSummary(connection) };
    }
    const updated = applyState(withSession(connection, outcome.session, this.cipher), outcome, this.now().toISOString());
    await this.repository.save(updated);
    return toLinkState(updated, outcome);
  }
}

/**
 * Cómo va la vinculación (la pantalla lo consulta mientras muestra el QR):
 * el QR renovado, el número ya conectado o la sesión cerrada.
 */
export class CheckConnectionService {
  public constructor(
    private readonly repository: ConnectionRepository,
    private readonly linkers: WhatsAppLinkers,
    private readonly cipher: SecretCipher,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async execute(tenantId: string, id: string): Promise<ConnectionLinkState> {
    const connection = await requireConnection(this.repository, tenantId, id);
    const session = sessionOf(connection, this.cipher);
    if (!session) return { state: "disconnected", connection: toConnectionSummary(connection) };

    const state = await this.linkers.for(connection.method).check(session).catch(upstream);
    const updated = applyState(connection, state, this.now().toISOString());
    if (updated.status !== connection.status || updated.phoneNumber !== connection.phoneNumber || updated.profileName !== connection.profileName) {
      await this.repository.save(updated);
    }
    return toLinkState(updated, state);
  }
}

// --- Avisos del proveedor --------------------------------------------------------

export interface ProviderConnectionEvent {
  /** Conexión a la que se refiere (sale del nombre de la instancia). */
  readonly connectionId: string;
  /** Credencial con que firma el aviso el proveedor. */
  readonly secret: string;
  readonly status: "connected" | "connecting" | "disconnected";
  readonly phoneNumber?: string | null;
  readonly profileName?: string | null;
}

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Un aviso de conexión del proveedor (p. ej. «el número se desconectó»). No
 * hay sesión de usuario: el aviso vale solo si trae la credencial de ESA
 * conexión. Devuelve `false` si no se reconoce (se ignora sin decir por qué).
 */
export class HandleProviderEventService {
  public constructor(
    private readonly repository: ConnectionRepository,
    private readonly cipher: SecretCipher,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async execute(event: ProviderConnectionEvent): Promise<boolean> {
    const connection = await this.repository.findForProvider(event.connectionId);
    if (!connection) return false;
    let session: ProviderSession | null;
    try {
      session = sessionOf(connection, this.cipher);
    } catch {
      return false;
    }
    if (!session || !sameSecret(session.secret, event.secret)) return false;

    const phone = normalizePhoneNumber(event.phoneNumber ?? connection.phoneNumber ?? "");
    const state: SessionState =
      event.status === "connected" && phone
        ? { kind: "connected", phoneNumber: phone, profileName: event.profileName ?? connection.profileName, profilePictureUrl: connection.profilePictureUrl }
        : event.status === "connecting"
          ? { kind: "qr", qrImage: "" }
          : { kind: "disconnected" };
    if (state.kind === "connected" && connection.status === "connected") return true;
    await this.repository.save(applyState(connection, state, this.now().toISOString()));
    return true;
  }
}
