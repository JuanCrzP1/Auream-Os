import type { HttpRequester, HttpSendResult } from "../../flow-engine/ports/HttpRequester";
import type { FetchMediaResult, MediaFetcher } from "../../flow-engine/ports/MediaFetcher";

/**
 * Entorno sin peticiones externas (tests, simulación sin red): toda petición
 * o descarga termina en «no disponible», que el bloque trata como un fallo más.
 */
export class DisabledHttpRequester implements HttpRequester, MediaFetcher {
  public async send(): Promise<HttpSendResult> {
    return { ok: false, reason: "unavailable", message: "Las peticiones externas no están disponibles en este entorno.", durationMs: 0 };
  }

  public async fetch(): Promise<FetchMediaResult> {
    return { ok: false, reason: "unavailable", message: "Las descargas no están disponibles en este entorno." };
  }
}
