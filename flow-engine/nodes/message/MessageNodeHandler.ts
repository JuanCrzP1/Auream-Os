import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { ChatPresence, NodeExecutionResult, OutboundMessage, RuntimeInput } from "../../../contracts/RuntimeContracts";
import { INLINE_PAUSE_BUDGET_MS } from "../../../contracts/FlowTimerContracts";
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
// «ESCRIBIENDO…» (como Leona). Durante una pausa el cliente ve lo que se
// prepara: «grabando audio…» si lo siguiente es un audio, «escribiendo…» si es
// texto u otro archivo (`presenceBefore`). Una pausa al final no muestra nada.
//
// PAUSAS LARGAS (FASE C6). Las pausas de un turno pueden sumar hasta
// `INLINE_PAUSE_BUDGET_MS` (la función que entrega tiene tiempo limitado). La
// que no cabe detiene el flujo: lo enviado hasta ahí sale ya, la sesión queda
// `delayed` con `resumeAt` = fin de esa pausa y la posición se recuerda en el
// contexto (`messageCursorKey`). El despertador retoma el MISMO bloque justo
// después de la pausa. Así el orden se respeta: nada posterior del flujo
// ocurre antes de que el mensaje termine.
//
// Un archivo sin URL (subida que no terminó) no se inventa: queda como evento
// `message_item_not_deliverable`. «Enviar una sola vez» se recuerda en la
// conversación (`contextPatch`) y no se repite.
// ---------------------------------------------------------------------------

/** Clave de contexto que recuerda un bloque «enviar una sola vez» ya enviado. */
export function sentOnceKey(nodeId: string, itemId: string): string {
  return `__sent_once.${nodeId}.${itemId}`;
}

/** Clave de contexto con el bloque desde el que retomar el Mensaje tras una pausa larga. */
export function messageCursorKey(nodeId: string): string {
  return `__message_cursor.${nodeId}`;
}

/** Qué ve el cliente durante la pausa en `index`: según el siguiente bloque que no sea pausa. */
export function presenceBefore(items: ReadonlyArray<MessageItem>, index: number): ChatPresence | undefined {
  const next = items.slice(index + 1).find((item) => item.kind !== "interval");
  if (!next) return undefined;
  return next.kind === "audio" ? "recording" : "composing";
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
    const cursorKey = messageCursorKey(node.id);
    const savedCursor = session.context[cursorKey];
    const start = input.timer === "resume" && typeof savedCursor === "number" && savedCursor > 0 ? savedCursor : 0;
    if (start > 0) contextPatch[cursorKey] = null;
    let pausedMs = input.inlinePauseUsedMs ?? 0;

    for (const [index, item] of items.entries()) {
      if (index < start) continue;
      if (item.kind === "text") {
        if (texts[index]!.trim()) outputMessages.push({ ...base, content: texts[index]! });
        continue;
      }
      if (item.kind === "interval") {
        const ms = intervalMs(item);
        const presence = presenceBefore(items, index);
        if (pausedMs + ms > INLINE_PAUSE_BUDGET_MS) {
          // No cabe en este turno: sigue después de la pausa, con la cola de tareas.
          // El cliente ve «escribiendo…» o «grabando audio…» mientras tanto.
          const resumeAt = new Date(new Date(input.now).getTime() + pausedMs + ms).toISOString();
          return {
            executionStatus: "delayed",
            outputMessages: presence ? [...outputMessages, { ...base, kind: "presence", content: "", presence, delayMs: ms }] : outputMessages,
            contextPatch: { ...contextPatch, [cursorKey]: index + 1 },
            nodeResult: { resumeAt, pausedAtItem: index },
            domainEvents: [...domainEvents, `message_paused:${node.id}:${index}`]
          };
        }
        pausedMs += ms;
        outputMessages.push({ ...base, kind: "pause", content: "", delayMs: ms, ...(presence ? { presence } : {}) });
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
