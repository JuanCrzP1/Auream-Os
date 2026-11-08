import type { ConversionTracker, TrackConversionResult } from "../../flow-engine/ports/ConversionTracker";

/** Entorno sin envío de eventos (tests): el bloque lo registra como no disponible y sigue. */
export class DisabledConversionTracker implements ConversionTracker {
  public async track(): Promise<TrackConversionResult> {
    return { ok: false, reason: "unavailable", message: "El envío de eventos a Meta no está disponible en este entorno." };
  }
}
