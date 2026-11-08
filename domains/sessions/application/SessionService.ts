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

export class SessionService {
  public constructor(private readonly repository: SessionRepository) {}

  public async getOrCreateActive(
    tenantId: string,
    envelope: InboundEnvelope,
    snapshot: FlowSnapshot
  ): Promise<Session> {
    const key = `${tenantId}:${envelope.conversationKey}`;
    const existing = await this.repository.find(key);

    if (existing) {
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
      revision: 1,
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
