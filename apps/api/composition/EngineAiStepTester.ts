import { readAiConfig } from "../../../contracts/AiConfig";
import type { AiTestResult } from "../../../contracts/AiTestContracts";
import { sampleResolver } from "../../../contracts/TemplateVariables";
import type { AiStepTester } from "../../../domains/automations/builder/application/ports/AiStepTester";
import type { AiGateway } from "../../../flow-engine/ports/AiGateway";
import { runAiStep } from "../../../flow-engine/nodes/ai/runAiStep";

/**
 * «Probar» recorre EXACTAMENTE el mismo código que el bloque en un flujo
 * (`runAiStep`), con el mensaje de prueba como `{last_message}` y ejemplos
 * para el resto de variables. Sin memoria de conversación.
 */
export class EngineAiStepTester implements AiStepTester {
  public constructor(private readonly ai: AiGateway) {}

  public async test(
    tenantId: string,
    config: Readonly<Record<string, unknown>>,
    message: string,
    variables: Readonly<Record<string, string>>
  ): Promise<AiTestResult> {
    const step = await runAiStep(readAiConfig(config), { tenantId, resolve: sampleResolver({ ...variables, last_message: message }), history: [] }, this.ai);
    return {
      succeeded: step.succeeded,
      ...(step.reason ? { reason: step.reason } : {}),
      ...(step.message ? { message: step.message } : {}),
      reply: step.reply,
      output: step.output,
      intentKey: step.intentKey,
      unparsed: step.unparsed,
      durationMs: step.durationMs,
      ...(step.usage ? { usage: step.usage } : {}),
      missingVariables: step.missingVariables
    };
  }
}
