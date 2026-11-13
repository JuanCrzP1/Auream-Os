import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, OutboundMessage, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import {
  WAIT_RESPONSE_OUTPUT,
  readWaitResponseConfig,
  resolveContextKey,
  waitResponseRetryKey,
  waitResponseTimeoutMs
} from "../../../contracts/WaitResponseConfig";
import type { NodeHandler } from "../NodeHandler";
import { ConversationTemplates } from "../../templates/ConversationTemplates";
import { waitStartsAt } from "../../scheduling/waitStartsAt";
import { NO_CONTACT_FIELDS, type ContactFieldCatalog } from "../../ports/ContactFieldCatalog";
import { answerFit, attemptsOf } from "./answerFit";

// ---------------------------------------------------------------------------
// Nodo `question` — la herramienta «Esperar respuesta».
//
// Dos pasadas por el mismo nodo:
//
//   1ª  todavía no se espera → se emite el mensaje previo (si lo hay) y la
//       sesión queda en `waiting_input`.
//   2ª  llega la respuesta   → se guarda en contexto si hay campo destino, se
//       reacciona si se configuró, y el flujo sigue. Con «Preguntar de nuevo»
//       y un campo con tipo, si no encaja vuelve a preguntar (`answerFit`) y
//       la espera empieza otra vez.
//
//   vence   con tiempo máximo, la 1ª pasada declara `waitDeadlineAt`; el motor
//           lo devuelve como despertador y la cola de tareas (FASE C6) lo
//           dispara: llega `input.timer = "timeout"` y sale por «Tiempo agotado».
//
// LO QUE ESTE HANDLER NO PUEDE HACER HOY, Y NO FINGE:
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
  public constructor(
    private readonly templates: ConversationTemplates = new ConversationTemplates(),
    private readonly fields: ContactFieldCatalog = NO_CONTACT_FIELDS
  ) {}

  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "question";
  }

  public async execute(node: FlowNode, input: RuntimeInput, session: Session): Promise<NodeExecutionResult> {
    const config = readWaitResponseConfig(node.config);
    const inboundText = input.envelope.payload.text;
    // Una foto, audio o archivo también es respuesta: se guarda su enlace
    // (lo lee, p. ej., el Comprobante automático). Si no, el texto.
    const inboundMedia = input.envelope.payload["mediaUrl"];
    const answer =
      typeof inboundMedia === "string" && inboundMedia.length > 0
        ? inboundMedia
        : typeof inboundText === "string" && inboundText.length > 0
          ? inboundText
          : null;

    // Lo que la espera declara sobre sí misma. Viaja en las dos pasadas para
    // que quien inspeccione la ejecución vea la misma configuración en ambas.
    const timeoutMs = waitResponseTimeoutMs(config);
    const declaracionDeEspera = {
      waitIndefinitely: config.waitIndefinitely,
      ...(timeoutMs !== null ? { waitTimeoutMs: timeoutMs } : {}),
      ...(config.groupMessages ? { groupMessages: true } : {})
    };

    // Venció el tiempo máximo sin respuesta. Sin límite configurado no hay
    // vencimiento posible: un despertador así (de una versión anterior) no la saca.
    if (input.timer === "timeout") {
      if (timeoutMs === null) {
        return { executionStatus: "waiting_input", outputMessages: [], contextPatch: {}, nodeResult: declaracionDeEspera, domainEvents: [`question_timeout_ignored:${node.id}`] };
      }
      return {
        executionStatus: "success",
        output: WAIT_RESPONSE_OUTPUT.timeout,
        outputMessages: [],
        contextPatch: resetRetries(input, node.id),
        nodeResult: { timedOut: true, ...declaracionDeEspera },
        domainEvents: [`question_timed_out:${node.id}`]
      };
    }

    if (input.isWaitingInput && answer !== null) {
      // Guardar la respuesta en contexto es opcional y lo decide `config.targetKey`.
      // Esta capacidad venía del retirado nodo `capture`: una pregunta que no
      // recuerda lo que le contestaron no sirve para nada aguas abajo.
      const contextKey = resolveContextKey(config.targetKey);
      const retryKey = waitResponseRetryKey(node.id);
      const fit = await answerFit(config, contextKey, answer, attemptsOf(input.sessionContext[retryKey]), { tenantId: session.tenantId, fields: this.fields });
      if (fit.kind === "retry") {
        const [custom = ""] = config.retryMessage ? await this.templates.render([config.retryMessage], input, session) : [];
        return {
          executionStatus: "waiting_input",
          // Cita lo que escribió: así se entiende qué no encajó.
          outputMessages: [{ channel: input.envelope.channel, conversationKey: input.envelope.conversationKey, content: custom || fit.message, replyToMessageId: input.envelope.messageId }],
          contextPatch: { [retryKey]: fit.attempt },
          nodeResult: { ...declaracionDeEspera, mismatch: true, attempt: fit.attempt, ...this.deadline(input, timeoutMs) },
          domainEvents: [`question_retried:${node.id}`]
        };
      }

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
        // Sale por «Respuesta» (C14); «Tiempo agotado» lo dispara el despertador (C6).
        output: WAIT_RESPONSE_OUTPUT.answer,
        outputMessages: reaccion,
        contextPatch: { ...(contextKey ? { [contextKey]: fit.kind === "fits" ? fit.value : answer } : {}), ...resetRetries(input, node.id) },
        nodeResult: {
          capturedInput: answer,
          ...(contextKey ? { storedKey: contextKey } : {}),
          ...declaracionDeEspera
        },
        domainEvents: [`question_answered:${node.id}`, ...(fit.kind === "gave_up" ? [`question_mismatch_kept:${node.id}`] : [])]
      };
    }

    // MENSAJE ANTES DE ESPERAR: opcional. Sin texto no se emite nada y el nodo
    // se limita a esperar — que es justo lo que se pide de un «Esperar
    // respuesta» colocado detrás de un Mensaje que ya preguntó.
    const [texto = ""] = await this.templates.render([String(node.content.text ?? "")], input, session);
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

    return {
      executionStatus: "waiting_input",
      outputMessages: mensajePrevio,
      contextPatch: {},
      nodeResult: { ...declaracionDeEspera, ...this.deadline(input, timeoutMs) },
      domainEvents: [`question_prompted:${node.id}`]
    };
  }

  /**
   * Hasta cuándo se espera, calculado desde la recepción real (y tras las
   * pausas que ya puso el turno), no desde el reloj del proceso. Sin una fecha
   * de recepción legible se omite el vencimiento y nada más: inventarlo sería
   * mentir sobre cuándo empezó la espera. Relativa: cuenta desde que sale la
   * pregunta (`waitFrom`; la entrega la corrige).
   */
  private deadline(input: RuntimeInput, timeoutMs: number | null): { waitDeadlineAt?: string; waitFrom?: string } {
    const from = waitStartsAt(new Date(input.envelope.receivedAt).getTime(), input);
    if (timeoutMs === null || !Number.isFinite(from)) return {};
    return { waitDeadlineAt: new Date(from + timeoutMs).toISOString(), waitFrom: new Date(from).toISOString() };
  }
}

/** Al salir del bloque se olvidan los intentos (si vuelve a pasar por él, empieza de cero). */
function resetRetries(input: RuntimeInput, nodeId: string): Record<string, unknown> {
  const key = waitResponseRetryKey(nodeId);
  return input.sessionContext[key] !== undefined && input.sessionContext[key] !== null ? { [key]: null } : {};
}
