import type { ConversationSummary } from "../../../contracts/ConversationContracts";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { parseAgentReply } from "./AgentReply";
import type { ConversationRecorder } from "./ConversationRecorder";
import type { Agent, ConversationInbox } from "./ConversationServices";
import type { ChatContacts, ChatNumbers } from "./ports/ConversationPorts";

// ---------------------------------------------------------------------------
// «Chat nuevo»: escribirle primero a un número (o abrir su chat si ya
// existe), desde un número conectado de la cuenta. El cliente queda en
// Contactos y el primer mensaje sale como del asesor (el chat queda a su
// nombre) o como un flujo (lo atiende el bot).
// ---------------------------------------------------------------------------

export interface NewChatInput {
  readonly connectionId?: unknown;
  readonly phone?: unknown;
  readonly name?: unknown;
  readonly message?: unknown;
  readonly automationId?: unknown;
}

export class NewChatService {
  public constructor(
    private readonly numbers: ChatNumbers,
    private readonly contacts: ChatContacts,
    private readonly recorder: Pick<ConversationRecorder, "openChat">,
    private readonly inbox: Pick<ConversationInbox, "sendAgentMessage" | "startFlow" | "get">
  ) {}

  public async start(tenantId: string, input: NewChatInput, agent: Agent): Promise<ConversationSummary> {
    const connectionId = typeof input.connectionId === "string" ? input.connectionId : "";
    if (!connectionId) throw new ValidationError("Elige desde qué número de WhatsApp escribir.");
    const phone = typeof input.phone === "string" ? input.phone.replace(/\D/g, "") : "";
    if (!/^[0-9]{7,15}$/.test(phone)) throw new ValidationError("Escribe el número completo, con el prefijo del país.");
    const name = typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 80) : null;
    const automationId = typeof input.automationId === "string" && input.automationId ? input.automationId : null;
    // Lo que se va a enviar se valida antes de crear nada.
    if (!automationId) parseAgentReply(input.message);
    if (!(await this.numbers.isConnected(tenantId, connectionId))) {
      throw new ValidationError("Ese número de WhatsApp no está conectado. Conéctalo en Conexiones o elige otro.");
    }

    const { contactId } = await this.contacts.identify(tenantId, phone, name);
    const chat = await this.recorder.openChat(tenantId, connectionId, phone, contactId);
    if (automationId) await this.inbox.startFlow(tenantId, chat.id, automationId);
    else await this.inbox.sendAgentMessage(tenantId, chat.id, input.message, agent);
    return this.inbox.get(tenantId, chat.id);
  }
}
