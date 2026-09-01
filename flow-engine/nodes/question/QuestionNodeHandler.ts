import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

/**
 * Normaliza la clave de contexto donde se guarda la respuesta.
 *
 * Se acepta tanto `nombre` como `context.nombre` y se almacena siempre sin el
 * prefijo, porque `EdgeEvaluator` y las plantillas `{{context.x}}` resuelven
 * contra `session.context[x]`. Guardar la clave con el prefijo dejaría el valor
 * escrito pero ilegible para ambos.
 */
function resolveContextKey(targetKey: unknown): string | null {
  if (typeof targetKey !== "string" || targetKey.trim().length === 0) {
    return null;
  }

  return targetKey.trim().replace(/^context\./, "");
}

export class QuestionNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "question";
  }

  public execute(node: FlowNode, input: RuntimeInput, _session: Session): NodeExecutionResult {
    const inboundText = input.envelope.payload.text;

    if (input.isWaitingInput && typeof inboundText === "string" && inboundText.length > 0) {
      // Guardar la respuesta en contexto es opcional y lo decide `config.targetKey`.
      // Esta capacidad venía del retirado nodo `capture`: una pregunta que no
      // recuerda lo que le contestaron no sirve para nada aguas abajo.
      const contextKey = resolveContextKey(node.config.targetKey);

      return {
        executionStatus: "success",
        outputMessages: [],
        contextPatch: contextKey ? { [contextKey]: inboundText } : {},
        nodeResult: {
          capturedInput: inboundText,
          ...(contextKey ? { storedKey: contextKey } : {})
        },
        domainEvents: [`question_answered:${node.id}`]
      };
    }

    return {
      executionStatus: "waiting_input",
      outputMessages: [
        {
          channel: input.envelope.channel,
          conversationKey: input.envelope.conversationKey,
          content: String(node.content.text ?? "")
        }
      ],
      contextPatch: {},
      nodeResult: {},
      domainEvents: [`question_prompted:${node.id}`]
    };
  }
}