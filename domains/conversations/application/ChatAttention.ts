import type { ChatAgent, ConversationSummary } from "../../../contracts/ConversationContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import type { ConversationRepository } from "./ConversationRepository";
import type { ChatTeam, DealOwners } from "./ports/ConversationPorts";

// ---------------------------------------------------------------------------
// La atención de un chat (fase 2): tomarlo, pasarlo a otro asesor, dejarlo
// sin asignar y resolverlo. Las reglas de cada estado: `domain/ChatStatus.ts`.
// El responsable es el mismo del CRM: al tomar o pasar un chat, los negocios
// del cliente que no tenían responsable quedan con esa persona.
// ---------------------------------------------------------------------------

export class ChatAttention {
  public constructor(
    private readonly repository: ConversationRepository,
    private readonly team: ChatTeam,
    private readonly owners: DealOwners
  ) {}

  /** Quien puede atender chats («Pasar a…» y el filtro por responsable). */
  public agents(tenantId: string): Promise<ReadonlyArray<ChatAgent>> {
    return this.team.agents(tenantId);
  }

  /** «Tomar chat»: queda a nombre de quien mira y el bot se pausa. */
  public take(tenantId: string, id: string, userId: string): Promise<ConversationSummary> {
    return this.assign(tenantId, id, userId, userId);
  }

  /** Pasar el chat a un asesor del equipo, o dejarlo sin asignar (`null`: vuelve a «En espera»). */
  public async assign(tenantId: string, id: string, assigneeId: unknown, actorId: string): Promise<ConversationSummary> {
    if (assigneeId !== null && typeof assigneeId !== "string") throw new ValidationError("Elige a quién pasarle el chat.");
    const conversation = await this.requireLive(tenantId, id);
    if (assigneeId !== null && !(await this.team.agents(tenantId)).some((agent) => agent.userId === assigneeId)) {
      throw new ValidationError("Esa persona no está en el equipo o es de solo lectura.");
    }
    await this.repository.assign(tenantId, id, assigneeId);
    if (assigneeId && conversation.contactId) await this.owners.claimUnowned(tenantId, conversation.contactId, assigneeId, actorId);
    return this.summary(tenantId, id);
  }

  /** «Resolver»: el chat se cierra y el bot vuelve a atender; si el cliente escribe, se reabre solo. */
  public async resolve(tenantId: string, id: string): Promise<ConversationSummary> {
    await this.requireLive(tenantId, id);
    await this.repository.resolve(tenantId, id);
    return this.summary(tenantId, id);
  }

  private async summary(tenantId: string, id: string): Promise<ConversationSummary> {
    const summary = await this.repository.summary(tenantId, id);
    if (!summary) throw new NotFoundError("Conversación no encontrada.");
    return summary;
  }

  private async requireLive(tenantId: string, id: string) {
    const conversation = await this.repository.findById(tenantId, id);
    if (!conversation) throw new NotFoundError("Conversación no encontrada.");
    if (conversation.connectionDeleted) throw new ValidationError("El número de este chat fue eliminado: ya no se puede atender desde aquí.");
    return conversation;
  }
}
