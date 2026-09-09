import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, OutboundMessage, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import {
  readWaitResponseConfig,
  resolveContextKey,
  waitResponseTimeoutMs
} from "../../../contracts/WaitResponseConfig";
import type { NodeHandler } from "../NodeHandler";

// ---------------------------------------------------------------------------
// Nodo `question` — la herramienta «Esperar respuesta».
//
// Dos pasadas por el mismo nodo:
//
//   1ª  todavía no se espera → se emite el mensaje previo (si lo hay) y la
//       sesión queda en `waiting_input`.
//   2ª  llega la respuesta   → se guarda en contexto si hay campo destino, se
//       reacciona si se configuró, y el flujo sigue.
//
// LO QUE ESTE HANDLER NO PUEDE HACER HOY, Y NO FINGE:
//
//   · Vencer la espera. `config.timeout` se calcula y se DECLARA en
//     `nodeResult.waitTimeoutMs` / `waitDeadlineAt`, igual que `DelayNodeHandler`
//     declara su `resumeAt`, pero nada lo dispara: no hay cola —`apps/worker`
//     lo dice en su propia cabecera— y una sesión en `waiting_input` solo
//     despierta con un mensaje del cliente. El dato queda listo para el día que
//     exista el planificador; el comportamiento, no.
//
//   · Agrupar mensajes. Exige retener el primer mensaje unos segundos por si
//     llegan más, y esa capa de entrada no existe: el loop recibe UN envelope y
//     lo ejecuta. Se declara en `nodeResult.groupMessages` para que el futuro
//     búfer lo lea de donde ya está.
//
// Las dos limitaciones se declaran en el resultado en lugar de en un comentario
// suelto: así son observables desde fuera —un test las ve, el panel de
// simulación las ve— en vez de ser una promesa que nadie puede comprobar.
// ---------------------------------------------------------------------------

export class QuestionNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "question";
  }

  public execute(node: FlowNode, input: RuntimeInput, _session: Session): NodeExecutionResult {
    const config = readWaitResponseConfig(node.config);
    const inboundText = input.envelope.payload.text;

    // Lo que la espera declara sobre sí misma. Viaja en las dos pasadas para
    // que quien inspeccione la ejecución vea la misma configuración en ambas.
    const timeoutMs = waitResponseTimeoutMs(config);
    const declaracionDeEspera = {
      waitIndefinitely: config.waitIndefinitely,
      ...(timeoutMs !== null ? { waitTimeoutMs: timeoutMs } : {}),
      ...(config.groupMessages ? { groupMessages: true } : {})
    };

    if (input.isWaitingInput && typeof inboundText === "string" && inboundText.length > 0) {
      // Guardar la respuesta en contexto es opcional y lo decide `config.targetKey`.
      // Esta capacidad venía del retirado nodo `capture`: una pregunta que no
      // recuerda lo que le contestaron no sirve para nada aguas abajo.
      const contextKey = resolveContextKey(config.targetKey);

      // La reacción se pone sobre el mensaje que acaba de llegar, no sobre el
      // que este nodo envió: se reacciona a lo que dijo el cliente.
      const reaccion: OutboundMessage[] = config.reaction
        ? [
            {
              channel: input.envelope.channel,
              conversationKey: input.envelope.conversationKey,
              content: config.reaction,
              replyToMessageId: input.envelope.messageId,
              kind: "reaction"
            }
          ]
        : [];

      return {
        executionStatus: "success",
        outputMessages: reaccion,
        contextPatch: contextKey ? { [contextKey]: inboundText } : {},
        nodeResult: {
          capturedInput: inboundText,
          ...(contextKey ? { storedKey: contextKey } : {}),
          ...declaracionDeEspera
        },
        domainEvents: [`question_answered:${node.id}`]
      };
    }

    // MENSAJE ANTES DE ESPERAR: opcional. Sin texto no se emite nada y el nodo
    // se limita a esperar — que es justo lo que se pide de un «Esperar
    // respuesta» colocado detrás de un Mensaje que ya preguntó.
    const texto = String(node.content.text ?? "");
    const mensajePrevio: OutboundMessage[] =
      texto.length > 0
        ? [
            {
              channel: input.envelope.channel,
              conversationKey: input.envelope.conversationKey,
              content: texto,
              // Citar al cliente solo tiene sentido si hay a qué citar: en la
              // primera entrada al flujo el envelope trae el mensaje que lo
              // disparó, y ese es el que se responde.
              ...(config.replyToInbound && input.envelope.messageId
                ? { replyToMessageId: input.envelope.messageId }
                : {})
            }
          ]
        : [];

    // Vencimiento absoluto, calculado desde la recepción real y no desde el
    // reloj del proceso: si un día lo lee un planificador, tiene que poder
    // confiar en el instante que aquí se declara.
    //
    // SE COMPRUEBA QUE `receivedAt` SEA UNA FECHA. Un envelope con una recepción
    // ilegible —vacía, malformada, ausente— daba `NaN` al restarle el reloj, y
    // `new Date(NaN).toISOString()` LANZA `RangeError`: la ejecución entera del
    // flujo se caía por un campo que este nodo solo lee de pasada. El resto del
    // handler ya no confiaba en nada —la configuración pasa por un lector
    // defensivo—, y esta era la única entrada que sí.
    //
    // Sin fecha utilizable se omite el vencimiento y NADA MÁS: `waitTimeoutMs`
    // se sigue declarando porque la duración configurada es válida y se conoce;
    // lo que no se puede decir es a qué instante concreto vence. Decir «espera
    // 30 minutos» sin poder fechar el final es exacto; inventar la fecha desde
    // el reloj del proceso habría sido mentir sobre cuándo empezó la espera.
    const recepcion = new Date(input.envelope.receivedAt).getTime();
    const vencimiento =
      timeoutMs !== null && Number.isFinite(recepcion)
        ? new Date(recepcion + timeoutMs).toISOString()
        : null;

    return {
      executionStatus: "waiting_input",
      outputMessages: mensajePrevio,
      contextPatch: {},
      nodeResult: {
        ...declaracionDeEspera,
        ...(vencimiento !== null ? { waitDeadlineAt: vencimiento } : {})
      },
      domainEvents: [`question_prompted:${node.id}`]
    };
  }
}
