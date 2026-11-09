import type { FlowSnapshot } from "../../../contracts/FlowSnapshot";
import type { InboundEnvelope, SessionStatus } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { SessionRepository } from "./SessionRepository";

// ---------------------------------------------------------------------------
// SessionService
//
// Gestiona transiciones de sesiones de ejecución de flows.
//
// Diseño inmutable: moveToNode() y updateStatus() crean un NUEVO objeto Session
// y lo persisten via SessionRepository. Nunca mutan el objeto original.
// Esto permite:
//   - migración directa a persistencia SQL (swap del repositorio, sin tocar este servicio)
//   - distribución a workers (serializar/deserializar sin pérdida de estado)
//   - auditoría de transiciones (el estado previo se puede capturar antes de la transición)
// ---------------------------------------------------------------------------

/** Estados en que la sesión sigue en curso (el próximo mensaje la continúa). */
export const LIVE_SESSION_STATUSES: ReadonlyArray<SessionStatus> = ["active", "waiting_input", "delayed", "paused"];

/** Identificador de la sesión de una conversación (una por conversación). */
export function sessionIdFor(tenantId: string, conversationKey: string): string {
  return `${tenantId}:${conversationKey}`;
}

export class SessionService {
  public constructor(private readonly repository: SessionRepository) {}

  /**
   * La sesión en curso de la conversación para ese flujo; si no hay, o la que
   * hay ya terminó (completada o fallida) o es de otro flujo, empieza una nueva
   * en la entrada del flujo. Así un cliente que termina un flujo y vuelve a
   * escribir no queda atascado en el final.
   */
  public async getOrCreateActive(
    tenantId: string,
    envelope: InboundEnvelope,
    snapshot: FlowSnapshot
  ): Promise<Session> {
    const key = sessionIdFor(tenantId, envelope.conversationKey);
    const existing = await this.repository.find(key);

    if (existing && existing.flowId === snapshot.flow.id && LIVE_SESSION_STATUSES.includes(existing.status)) {
      return existing;
    }

    const now = new Date().toISOString();

    const session: Session = {
      id: key,
      tenantId,
      flowId: snapshot.flow.id,
      flowVersionId: snapshot.version.id,
      channel: envelope.channel,
      conversationKey: envelope.conversationKey,
      userKey: envelope.userKey,
      currentNodeId: snapshot.version.entryNodeId,
      status: "active",
      revision: (existing?.revision ?? 0) + 1,
      context: {},
      createdAt: now,
      updatedAt: now
    };

    await this.repository.save(session);
    return session;
  }

  public async moveToNode(session: Session, nextNodeId: string, status: SessionStatus): Promise<Session> {
    const next: Session = {
      ...session,
      currentNodeId: nextNodeId,
      status,
      revision: session.revision + 1,
      updatedAt: new Date().toISOString()
    };
    await this.repository.save(next);
    return next;
  }

  public async updateStatus(session: Session, status: SessionStatus): Promise<Session> {
    const next: Session = {
      ...session,
      status,
      revision: session.revision + 1,
      updatedAt: new Date().toISOString()
    };
    await this.repository.save(next);
    return next;
  }
}
