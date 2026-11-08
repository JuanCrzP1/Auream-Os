import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, OutboundMessage, RuntimeInput, Session } from "../../../contracts/RuntimeContracts";
import { readAiConfig } from "../../../contracts/AiConfig";
import type { AiGateway } from "../../ports/AiGateway";
import { identityOf, type ContactDirectory } from "../../ports/ContactDirectory";
import { templateResolver } from "../../templates/templateResolver";
import type { NodeHandler } from "../NodeHandler";
import { appendHistory, historyKey, readHistory } from "./aiHistory";
import { runAiStep } from "./runAiStep";

// ---------------------------------------------------------------------------
// AiNodeHandler — el bloque «Extensión IA».
//
// Pide al modelo de la conexión elegida que responda (y, si hay intenciones,
// que clasifique) el mensaje del cliente. Guarda la respuesta en la variable
// configurada, la envía si así se pidió y sigue por la intención reconocida,
// por «respaldo» o por «Error».
//
// Un nodo de IA NO convierte el flujo en un agente: el flujo sigue siendo
// determinístico; el motor conversacional de ventas es `ai-sales-engine/`.
//
// Archivos (audio, imagen, PDF): el canal todavía no entrega adjuntos al motor
// (FASE D). Si el bloque los pide y llega uno, se DECLARA en el resultado en
// lugar de fingir que se leyó.
// ---------------------------------------------------------------------------

export class AiNodeHandler implements NodeHandler {
  public constructor(
    private readonly ai: AiGateway,
    private readonly contacts: ContactDirectory
  ) {}

  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "ai";
  }

  public async execute(node: FlowNode, input: RuntimeInput, session: Session): Promise<NodeExecutionResult> {
    const config = readAiConfig(node.config);
    const context = { ...input.sessionContext, ...session.context };
    const contact = await this.contacts.resolve(session.tenantId, identityOf(input.envelope));
    const history = config.keepContext ? readHistory(context, node.id) : [];

    const step = await runAiStep(config, { tenantId: session.tenantId, resolve: templateResolver({ ...input, sessionContext: context }, contact), history }, this.ai);
    const missingEvents = step.missingVariables.map((name) => `ai_variable_missing:${node.id}:${name}`);
    const wantsMedia = config.understandAudio || config.understandImage || config.understandPdf;
    const mediaEvents = wantsMedia && input.envelope.payload["media"] !== undefined ? [`ai_media_not_supported_yet:${node.id}`] : [];

    if (!step.succeeded) {
      return {
        executionStatus: "success",
        output: step.output,
        outputMessages: [],
        contextPatch: config.errorVariable ? { [config.errorVariable]: step.message } : {},
        nodeResult: { reason: step.reason, message: step.message, model: config.model, durationMs: step.durationMs },
        domainEvents: [`ai_failed:${node.id}:${step.reason}`, ...missingEvents, ...mediaEvents]
      };
    }

    const outputMessages: OutboundMessage[] =
      config.autoSend && step.reply
        ? [{ channel: input.envelope.channel, conversationKey: input.envelope.conversationKey, content: step.reply }]
        : [];

    return {
      executionStatus: "success",
      output: step.output,
      outputMessages,
      contextPatch: {
        ...(config.responseVariable ? { [config.responseVariable]: step.reply } : {}),
        ...(config.keepContext ? { [historyKey(node.id)]: appendHistory(history, step.userMessage, step.reply, config.contextTurns) } : {})
      },
      nodeResult: {
        model: config.model,
        durationMs: step.durationMs,
        ...(step.intentKey !== null ? { intent: step.intentKey } : {}),
        ...(step.usage ? { usage: step.usage } : {})
      },
      domainEvents: [
        step.intentKey !== null ? `ai_classified:${node.id}:${step.intentKey}` : `ai_replied:${node.id}`,
        ...(step.unparsed ? [`ai_intent_unparsed:${node.id}`] : []),
        ...missingEvents,
        ...mediaEvents
      ]
    };
  }
}
