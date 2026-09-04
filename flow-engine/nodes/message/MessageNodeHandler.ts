import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, OutboundMessage, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

// ---------------------------------------------------------------------------
// MessageNodeHandler
//
// Un nodo Mensaje contiene una SECUENCIA de contenidos (`config.items`) y emite
// uno de salida por cada contenido que el motor sabe enviar, en el mismo orden.
//
// El contrato ya lo permitía: `NodeExecutionResult.outputMessages` siempre fue
// un array. Lo que faltaba era que este handler lo aprovechara — antes emitía
// exactamente uno.
//
// QUÉ SE PUEDE ENVIAR HOY: solo texto. `OutboundMessage` tiene un único campo
// de contenido, de tipo `string`, así que no hay forma de transportar una
// imagen, un audio o un archivo aunque el nodo los tenga configurados. Esos
// contenidos NO se envían y NO se inventan: se registran como omitidos en los
// eventos de dominio, para que quede rastro observable en lugar de un silencio.
//
// Cambiar eso exige tres piezas que no existen —almacenamiento de medios, un
// `OutboundMessage` capaz de llevar algo que no sea texto, y un adaptador de
// canal que lo entregue— y ninguna se finge aquí.
//
// COMPATIBILIDAD: un nodo guardado antes de la secuencia no tiene `items` y sí
// `content.text`. Se sigue leyendo, como un único contenido de texto.
//
// La forma de `config` NO está garantizada por el compilador: viene de un JSON
// persistido. Por eso se estrecha con desconfianza en lugar de castear.
// ---------------------------------------------------------------------------

/** Contenido de la secuencia, ya estrechado a lo que este handler entiende. */
interface ReadItem {
  readonly kind: string;
  readonly text: string;
}

function readItems(node: FlowNode): ReadItem[] {
  const raw = node.config.items;

  if (Array.isArray(raw)) {
    return raw.flatMap((entry): ReadItem[] => {
      if (typeof entry !== "object" || entry === null) return [];

      const record = entry as Record<string, unknown>;
      const kind = typeof record.kind === "string" ? record.kind : "";
      if (kind === "") return [];

      return [{ kind, text: typeof record.text === "string" ? record.text : "" }];
    });
  }

  const legacy = node.content.text;
  return typeof legacy === "string" ? [{ kind: "text", text: legacy }] : [];
}

/** Resuelve `{{context.clave}}` contra el contexto de la sesión. */
function render(template: string, session: Session): string {
  return template.replace(/{{\s*context\.([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => {
    const value = session.context[key];
    return value == null ? "" : String(value);
  });
}

export class MessageNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "message";
  }

  public execute(node: FlowNode, input: RuntimeInput, session: Session): NodeExecutionResult {
    const items = readItems(node);
    const outputMessages: OutboundMessage[] = [];
    const domainEvents: string[] = [];

    for (const item of items) {
      if (item.kind !== "text") {
        // El contenido existe en la configuración pero el motor no puede
        // entregarlo. Se deja constancia en lugar de omitirlo en silencio.
        domainEvents.push(`message_item_not_deliverable:${node.id}:${item.kind}`);
        continue;
      }

      outputMessages.push({
        channel: input.envelope.channel,
        conversationKey: input.envelope.conversationKey,
        content: render(item.text, session)
      });
    }

    domainEvents.push(`message_node_executed:${node.id}`);

    return {
      executionStatus: "success",
      outputMessages,
      contextPatch: {},
      nodeResult: {},
      domainEvents
    };
  }
}
