import type { AdOrigin } from "../../../contracts/AdOrigin";
import { LIVE_SESSION_STATUSES, sessionIdFor } from "../../sessions/application/SessionService";
import type { SessionRepository } from "../../sessions/application/SessionRepository";
import type { ConnectionTriggerServices } from "../../connections/application/ConnectionTriggerServices";
import type { FlowCatalog } from "../../connections/application/ports/FlowCatalog";
import type { ContactDirectoryService } from "../../contacts/application/ContactDirectoryService";
import type { InboundContacts, LiveSessions, SessionControl, TriggerRouter } from "./ports/MessagingPorts";
import { WHATSAPP_CHANNEL } from "./HandleInboundMessageService";

// ---------------------------------------------------------------------------
// Adaptadores de los puertos de la mensajería a los módulos que los cumplen
// (Contactos, Sesiones, Conexiones). Solo traducen: la lógica vive en cada módulo.
// ---------------------------------------------------------------------------

export class DirectoryInboundContacts implements InboundContacts {
  public constructor(private readonly directory: ContactDirectoryService) {}

  public async identify(tenantId: string, phone: string, displayName: string | null, ad: AdOrigin | null = null) {
    const { profile, isNew } = await this.directory.identify(tenantId, { channel: WHATSAPP_CHANNEL, externalKey: phone }, displayName, ad);
    return { contactId: profile.id, isNew };
  }
}

/** El flujo en curso de la conversación (su clave), si el cliente está dentro de uno que aún existe. */
export class SessionLiveSessions implements LiveSessions {
  public constructor(
    private readonly sessions: SessionRepository,
    private readonly flows: FlowCatalog
  ) {}

  public async liveFlowOf(tenantId: string, conversationKey: string): Promise<string | null> {
    const session = await this.sessions.find(sessionIdFor(tenantId, conversationKey));
    if (!session || !LIVE_SESSION_STATUSES.includes(session.status)) return null;
    const [flow] = await this.flows.findMany(tenantId, [session.flowId]);
    return flow && !flow.archived ? flow.key : null;
  }
}

export class ConnectionTriggerRouter implements TriggerRouter {
  public constructor(private readonly triggers: ConnectionTriggerServices) {}

  public async route(tenantId: string, connectionId: string, facts: Parameters<TriggerRouter["route"]>[2]) {
    const resolved = await this.triggers.resolve(tenantId, connectionId, facts);
    return resolved ? { flowKey: resolved.flowKey, triggerId: resolved.triggerId } : null;
  }
}

/** Termina la sesión en curso (si hay) marcándola como completada. */
export class RepositorySessionControl implements SessionControl {
  public constructor(private readonly sessions: SessionRepository) {}

  public async endLive(tenantId: string, conversationKey: string): Promise<void> {
    const session = await this.sessions.find(sessionIdFor(tenantId, conversationKey));
    if (!session || !LIVE_SESSION_STATUSES.includes(session.status)) return;
    await this.sessions.save({ ...session, status: "completed", revision: session.revision + 1, updatedAt: new Date().toISOString() });
  }
}
