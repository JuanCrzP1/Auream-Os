import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, OutboundMessage, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import { intervalMs, readMessageItems, type MessageItem } from "../../../contracts/MessageConfig";
import type { NodeHandler } from "../NodeHandler";
import { ConversationTemplates } from "../../templates/ConversationTemplates";

// ---------------------------------------------------------------------------
// MessageNodeHandler
//
// Un nodo Mensaje es una SECUENCIA de bloques (`contracts/MessageConfig.ts`) y
// emite una salida por bloque, en el mismo orden:
//
//   texto     → `text` (variables resueltas)
//   archivo   → `media` con su URL pública; la leyenda, con variables
//   pausa     → `pause` con su duración; la entrega espera antes de seguir
//
// Un archivo sin URL (subida que no terminó) no se inventa: queda como evento
// `message_item_not_deliverable`. «Enviar una sola vez» se recuerda en la
// conversación (`contextPatch`) y no se repite.
// ---------------------------------------------------------------------------

/** Clave de contexto que recuerda un bloque «enviar una sola vez» ya enviado. */
export function sentOnceKey(nodeId: string, itemId: string): string {
  return `__sent_once.${nodeId}.${itemId}`;
}

/** Texto de cada bloque que lleva variables (texto o leyenda). */
function templateOf(item: MessageItem): string {
  if (item.kind === "text") return item.text;
  if (item.kind === "interval") return "";
  return item.caption;
}

export class MessageNodeHandler implements NodeHandler {
  public constructor(private readonly templates: ConversationTemplates = new ConversationTemplates()) {}

  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "message";
  }

  public async execute(node: FlowNode, input: RuntimeInput, session: Session): Promise<NodeExecutionResult> {
    const items = readMessageItems(node.config, node.content);
    const texts = await this.templates.render(items.map(templateOf), input, session);
    const outputMessages: OutboundMessage[] = [];
    const domainEvents: string[] = [];
    const contextPatch: Record<string, unknown> = {};
    const base = { channel: input.envelope.channel, conversationKey: input.envelope.conversationKey };

    for (const [index, item] of items.entries()) {
      if (item.kind === "text") {
        if (texts[index]!.trim()) outputMessages.push({ ...base, content: texts[index]! });
        continue;
      }
      if (item.kind === "interval") {
        outputMessages.push({ ...base, kind: "pause", content: "", delayMs: intervalMs(item) });
        continue;
      }
      if (!item.url) {
        domainEvents.push(`message_item_not_deliverable:${node.id}:${item.kind}`);
        continue;
      }
      const onceKey = sentOnceKey(node.id, item.id);
      if (item.sendOnce && session.context[onceKey] === true) continue;
      if (item.sendOnce) contextPatch[onceKey] = true;
      outputMessages.push({
        ...base,
        kind: "media",
        content: texts[index]!,
        media: { type: item.kind, url: item.url, ...(item.fileName ? { fileName: item.fileName } : {}) }
      });
    }

    domainEvents.push(`message_node_executed:${node.id}`);

    return {
      executionStatus: "success",
      outputMessages,
      contextPatch,
      nodeResult: {},
      domainEvents
    };
  }
}
