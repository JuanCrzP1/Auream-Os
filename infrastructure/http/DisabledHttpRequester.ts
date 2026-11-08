import type { HttpRequester, HttpSendResult } from "../../flow-engine/ports/HttpRequester";

/**
 * Entorno sin peticiones externas (tests, simulación sin red): toda petición
 * termina en «no disponible», que el bloque trata como un fallo más.
 */
export class DisabledHttpRequester implements HttpRequester {
  public async send(): Promise<HttpSendResult> {
    return { ok: false, reason: "unavailable", message: "Las peticiones externas no están disponibles en este entorno.", durationMs: 0 };
  }
}
