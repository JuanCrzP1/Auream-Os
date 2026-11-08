import { randomUUID } from "node:crypto";
import { readPixelConfig } from "../../../contracts/PixelConfig";
import type { PixelTestResult } from "../../../contracts/PixelTestContracts";
import { sampleResolver } from "../../../contracts/TemplateVariables";
import type { PixelEventTester } from "../../../domains/automations/builder/application/ports/PixelEventTester";
import type { ConversionTracker } from "../../../flow-engine/ports/ConversionTracker";
import { runPixelStep } from "../../../flow-engine/nodes/pixel/runPixelStep";

/**
 * «Probar» recorre EXACTAMENTE el mismo código que el bloque (`runPixelStep`),
 * con un contacto de ejemplo y el código de prueba de Meta.
 */
export class EnginePixelEventTester implements PixelEventTester {
  public constructor(private readonly tracker: ConversionTracker) {}

  public async test(
    tenantId: string,
    config: Readonly<Record<string, unknown>>,
    testEventCode: string,
    variables: Readonly<Record<string, string>>
  ): Promise<PixelTestResult> {
    const step = await runPixelStep(
      readPixelConfig(config),
      {
        tenantId,
        testEventCode,
        context: { resolve: sampleResolver(variables), externalId: "auream-prueba", eventId: `prueba:${randomUUID()}`, now: new Date() }
      },
      this.tracker
    );
    return {
      succeeded: step.succeeded,
      ...(step.reason ? { reason: step.reason } : {}),
      ...(step.message ? { message: step.message } : {}),
      ...(step.eventName ? { eventName: step.eventName } : {}),
      ...(step.actionSource ? { actionSource: step.actionSource } : {}),
      ...(step.value !== undefined ? { value: step.value, currency: step.currency } : {}),
      ...(step.eventsReceived !== undefined ? { eventsReceived: step.eventsReceived } : {}),
      durationMs: step.durationMs,
      missingVariables: step.missingVariables
    };
  }
}
