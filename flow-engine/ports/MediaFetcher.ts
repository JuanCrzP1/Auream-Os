import type { HttpFailureReason } from "./HttpRequester";

// ---------------------------------------------------------------------------
// MediaFetcher — descargar el archivo que mandó el cliente (la foto o el PDF
// del comprobante) a partir de su URL.
//
// En producción lo cumple `SafeHttpRequester`: solo Internet público (SSRF),
// plazo total y tope de tamaño. En tests, uno falso.
// ---------------------------------------------------------------------------

export interface FetchMediaRequest {
  readonly url: string;
  readonly maxBytes: number;
  readonly timeoutMs: number;
}

export interface FetchedMedia {
  readonly bytes: Uint8Array;
  /** Tipo declarado por el servidor, en minúsculas y sin parámetros. */
  readonly contentType: string;
}

/**
 * Por qué no se obtuvo el archivo: los de `HttpRequester`, más
 *   not_found  el servidor respondió con un error (404, 403, 500…)
 */
export type FetchMediaFailure = HttpFailureReason | "not_found";

export type FetchMediaResult =
  | { readonly ok: true; readonly media: FetchedMedia }
  | { readonly ok: false; readonly reason: FetchMediaFailure; readonly message: string };

export interface MediaFetcher {
  fetch(request: FetchMediaRequest): Promise<FetchMediaResult>;
}
