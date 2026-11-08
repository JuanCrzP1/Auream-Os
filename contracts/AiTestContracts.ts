// ---------------------------------------------------------------------------
// «Probar» la Extensión IA desde el editor: se envía un mensaje de ejemplo con
// la configuración tal como está (sin guardar) y se ve qué respondería el
// bloque y por qué camino seguiría.
// ---------------------------------------------------------------------------

export interface AiTestRequest {
  readonly config: Readonly<Record<string, unknown>>;
  /** Lo que escribiría el cliente (rellena `{last_message}`). */
  readonly message: string;
  readonly variables?: Readonly<Record<string, string>>;
}

export interface AiTestResult {
  readonly succeeded: boolean;
  readonly reason?: string;
  readonly message?: string;
  readonly reply: string;
  /** Salida por la que seguiría el flujo (id) y su nombre. */
  readonly output: string;
  readonly intentKey: string | null;
  readonly unparsed: boolean;
  readonly durationMs: number;
  readonly usage?: { readonly inputTokens: number; readonly outputTokens: number };
  readonly missingVariables: ReadonlyArray<string>;
}
