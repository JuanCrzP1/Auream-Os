import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import { notificationRecipientPhone, readNotificationConfig } from "../../../contracts/NotificationConfig";
import type { NodeHandler } from "../NodeHandler";
import { ConversationTemplates } from "../../templates/ConversationTemplates";

// ---------------------------------------------------------------------------
// NotificationNodeHandler — avisa por WhatsApp a un número del equipo, como en
// Leona: el aviso sale por el MISMO número conectado que atiende el chat, en
// orden con lo demás del turno, y no queda en el chat del cliente
// (`OutboundMessage.recipient`). El texto admite variables (contacto, campos,
// datos del flujo, `{fecha}` y `{hora}`).
//
// Un aviso mal configurado (sin número válido o sin texto) no detiene la
// venta: el flujo sigue y queda anotado (`notification_skipped`).
// ---------------------------------------------------------------------------

export class NotificationNodeHandler implements NodeHandler {
  public constructor(private readonly templates: ConversationTemplates = new ConversationTemplates()) {}

  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "notification";
  }

  public async execute(node: FlowNode, input: RuntimeInput, session: Session): Promise<NodeExecutionResult> {
    const config = readNotificationConfig(node.config);
    const phone = notificationRecipientPhone(config);
    const [text] = await this.templates.render([config.message], input, session);
    const content = (text ?? "").trim();
    const name = config.name.trim() || "Equipo";

    if (!phone || !content) {
      return {
        executionStatus: "success",
        outputMessages: [],
        contextPatch: {},
        nodeResult: { notified: false, reason: !phone ? "invalid_phone" : "empty_message" },
        domainEvents: [`notification_skipped:${node.id}`]
      };
    }

    return {
      executionStatus: "success",
      outputMessages: [{ channel: input.envelope.channel, conversationKey: input.envelope.conversationKey, content, recipient: { phone, name } }],
      contextPatch: {},
      nodeResult: { notified: true, recipient: name },
      domainEvents: [`notification_sent:${node.id}`]
    };
  }
}
