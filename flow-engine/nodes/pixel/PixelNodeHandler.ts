import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput, Session } from "../../../contracts/RuntimeContracts";
import { readPixelConfig } from "../../../contracts/PixelConfig";
import type { ConversionTracker } from "../../ports/ConversionTracker";
import { identityOf, type ContactDirectory } from "../../ports/ContactDirectory";
import { templateResolver } from "../../templates/templateResolver";
import type { NodeHandler } from "../NodeHandler";
import { runPixelStep } from "./runPixelStep";

// ---------------------------------------------------------------------------
// PixelNodeHandler — el bloque «Pixel»: registra la conversión (Lead o
// Compra) en la API de Conversiones de Meta con el píxel elegido.
//
// Medir no puede interrumpir la conversación: si Meta falla, el flujo SIGUE
// por su única salida y el motivo queda en el resultado y los eventos.
//
// `eventId` = sesión + bloque + mensaje que disparó la ejecución: si la misma
// ejecución se repite, Meta descarta el duplicado; una compra nueva, en otra
// pasada, sí cuenta.
// ---------------------------------------------------------------------------

export class PixelNodeHandler implements NodeHandler {
  public constructor(
    private readonly tracker: ConversionTracker,
    private readonly contacts: ContactDirectory
  ) {}

  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "pixel";
  }

  public async execute(node: FlowNode, input: RuntimeInput, session: Session): Promise<NodeExecutionResult> {
    const config = readPixelConfig(node.config);
    const identity = identityOf(input.envelope);
    const contact = await this.contacts.resolve(session.tenantId, identity);
    const context = { ...input.sessionContext, ...session.context };

    const step = await runPixelStep(
      config,
      {
        tenantId: session.tenantId,
        context: {
          resolve: templateResolver({ ...input, sessionContext: context }, contact),
          externalId: contact.id,
          eventId: `${session.id}:${node.id}:${input.envelope.messageId}`,
          now: new Date(input.now)
        }
      },
      this.tracker
    );

    const missing = step.missingVariables.map((name) => `pixel_variable_missing:${node.id}:${name}`);
    return {
      executionStatus: "success",
      outputMessages: [],
      contextPatch: {},
      nodeResult: {
        ...(step.eventName ? { eventName: step.eventName, actionSource: step.actionSource } : {}),
        ...(step.value !== undefined ? { value: step.value, currency: step.currency } : {}),
        ...(step.succeeded ? { eventsReceived: step.eventsReceived } : { reason: step.reason, message: step.message }),
        durationMs: step.durationMs
      },
      domainEvents: [step.succeeded ? `pixel_sent:${node.id}:${step.eventName}` : `pixel_failed:${node.id}:${step.reason}`, ...missing]
    };
  }
}
