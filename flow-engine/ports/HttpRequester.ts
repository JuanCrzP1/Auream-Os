// ---------------------------------------------------------------------------
// HttpRequester — peticiones HTTP salientes del motor (bloque Integración).
//
// El motor no abre sockets: declara este puerto y la composición inyecta quien
// lo cumpla. En producción, `SafeHttpRequester`, que impide llegar a la red
// interna (SSRF), limita tiempos y tamaños y sigue redirecciones con las
// mismas reglas. En tests, uno falso.
// ---------------------------------------------------------------------------

export interface OutboundHttpRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeoutMs: number;
}

export interface OutboundHttpResponse {
  readonly status: number;
  /** Cabeceras en minúsculas. */
  readonly headers: Readonly<Record<string, string>>;
  /** Cuerpo como texto (UTF-8). */
  readonly body: string;
}

/**
 * Por qué no hubo respuesta:
 *   blocked_destination  la dirección es interna o privada (protección SSRF)
 *   timeout              no respondió a tiempo
 *   network_error        DNS, conexión rechazada, TLS…
 *   response_too_large   la respuesta supera el límite
 *   too_many_redirects   demasiadas redirecciones
 *   unavailable          este entorno no hace peticiones externas
 */
export type HttpFailureReason =
  | "blocked_destination"
  | "timeout"
  | "network_error"
  | "response_too_large"
  | "too_many_redirects"
  | "unavailable";

export type HttpSendResult =
  | { readonly ok: true; readonly response: OutboundHttpResponse; readonly durationMs: number }
  | { readonly ok: false; readonly reason: HttpFailureReason; readonly message: string; readonly durationMs: number };

export interface HttpRequester {
  send(request: OutboundHttpRequest): Promise<HttpSendResult>;
}
