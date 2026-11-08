import type { AiGateway, AiGenerateResult } from "../../flow-engine/ports/AiGateway";

/** Entorno sin modelos de IA (tests): el bloque sale por «Error» con «no disponible». */
export class DisabledAiGateway implements AiGateway {
  public async generate(): Promise<AiGenerateResult> {
    return { ok: false, reason: "unavailable", message: "La IA no está disponible en este entorno." };
  }
}
