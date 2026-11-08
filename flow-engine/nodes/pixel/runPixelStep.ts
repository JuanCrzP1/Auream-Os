import type { PixelConfig } from "../../../contracts/PixelConfig";
import type { ConversionFailureReason, ConversionTracker } from "../../ports/ConversionTracker";
import { buildConversionEvent, type ConversionBuildFailure, type ConversionContext } from "./buildConversionEvent";

// ---------------------------------------------------------------------------
// Una ejecución del bloque Pixel: armar el evento → enviarlo. La usan el
// bloque en un flujo y «Probar» del editor (a través de la API).
// ---------------------------------------------------------------------------

export interface PixelStepResult {
  readonly succeeded: boolean;
  readonly reason?: ConversionBuildFailure | ConversionFailureReason;
  readonly message?: string;
  readonly eventName?: string;
  readonly actionSource?: string;
  readonly value?: number;
  readonly currency?: string;
  readonly eventsReceived?: number;
  readonly durationMs: number;
  readonly missingVariables: ReadonlyArray<string>;
}

export async function runPixelStep(
  config: PixelConfig,
  input: { readonly tenantId: string; readonly context: ConversionContext; readonly testEventCode?: string },
  tracker: ConversionTracker,
  clock: () => number = Date.now
): Promise<PixelStepResult> {
  const built = buildConversionEvent(config, input.context);
  if (!built.ok) return { succeeded: false, reason: built.reason, message: built.message, durationMs: 0, missingVariables: built.missingVariables };

  const { event } = built;
  const described = {
    eventName: event.name,
    actionSource: event.actionSource,
    ...(event.value !== undefined ? { value: event.value, currency: event.currency } : {}),
    missingVariables: built.missingVariables
  };
  const started = clock();
  const result = await tracker.track(input.tenantId, {
    connectionId: config.connectionId,
    event,
    ...(input.testEventCode ? { testEventCode: input.testEventCode } : {})
  });
  const durationMs = clock() - started;

  return result.ok
    ? { succeeded: true, eventsReceived: result.eventsReceived, durationMs, ...described }
    : { succeeded: false, reason: result.reason, message: result.message, durationMs, ...described };
}
