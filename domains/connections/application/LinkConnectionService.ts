import type { ConnectionLinkState, LinkConnectionRequest } from "../../../contracts/ConnectionContracts";
import type { SecretCipher } from "../../../platform/security/secrets/SecretCipher";
import type { WhatsAppConnection } from "../domain/WhatsAppConnection";
import type { ConnectionRepository } from "./ConnectionRepository";
import { SessionGoneError, type ProviderSession, type WhatsAppLinkers } from "./ports/WhatsAppLinker";
import { applyState, requireConnection, sessionOf, toConnectionSummary, toLinkState, upstream, withSession } from "./connectionSession";

// ---------------------------------------------------------------------------
// Vincular o reconectar un número: el proveedor da un QR o lo conecta. Con
// `restart`, descarta el código en curso y empieza con uno nuevo.
//
// Dos pedidos a la vez (dos pestañas, doble clic) no pueden dejar dos sesiones
// en el proveedor: la sesión nueva se guarda solo si la conexión sigue con la
// que se leyó. El pedido que pierde borra la que creó y sigue con la del que
// ganó (mismo QR para los dos).
// ---------------------------------------------------------------------------

export class LinkConnectionService {
  public constructor(
    private readonly repository: ConnectionRepository,
    private readonly linkers: WhatsAppLinkers,
    private readonly cipher: SecretCipher,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async execute(tenantId: string, id: string, request: LinkConnectionRequest = {}): Promise<ConnectionLinkState> {
    return this.link(tenantId, id, request, true);
  }

  private async link(tenantId: string, id: string, request: LinkConnectionRequest, mayRetry: boolean): Promise<ConnectionLinkState> {
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
    if (outcome.session.ref === connection.providerRef) {
      await this.repository.save(updated);
      return toLinkState(updated, outcome);
    }
    // Sesión nueva en el proveedor: se queda solo si nadie se adelantó.
    if (await this.repository.saveIfSession(updated, connection.providerRef)) return toLinkState(updated, outcome);
    await this.discard(connection, outcome.session);
    if (!mayRetry) return { state: "disconnected", connection: toConnectionSummary(connection) };
    return this.link(tenantId, id, { ...request, restart: false }, false);
  }

  /** La sesión que perdió la carrera: se borra para no dejar un número huérfano (y cobrado) en el proveedor. */
  private async discard(connection: WhatsAppConnection, lost: ProviderSession): Promise<void> {
    await this.linkers.for(connection.method).unlink(lost).catch(() => undefined);
  }
}
