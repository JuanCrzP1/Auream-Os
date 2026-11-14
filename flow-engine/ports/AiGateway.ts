// ---------------------------------------------------------------------------
// AiGateway — lo que el bloque «Extensión IA» necesita de un modelo de IA.
//
//   AiNodeHandler → AiGateway (este puerto) → conexión de la cuenta → OpenAI | Gemini | OpenRouter
//
// El motor nunca ve una clave de API: pide «usa la conexión X de esta cuenta»
// y la composición la descifra y llama al proveedor (`VaultAiGateway`). Así
// ni el flujo, ni la sesión, ni los registros pueden filtrarla.
// ---------------------------------------------------------------------------

/**
 * Un archivo del cliente que el modelo ve u oye (solo en el mensaje actual):
 * una foto o una nota de voz, en base64. El PDF no viaja así: se lee su texto.
 */
export interface AiAttachment {
  readonly kind: "image" | "audio";
  /** `image/jpeg`, `audio/ogg`… (por la firma del archivo, no lo que dijo el servidor). */
  readonly mimeType: string;
  readonly data: string;
}

export interface AiMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly attachments?: ReadonlyArray<AiAttachment>;
}

export interface AiGenerateRequest {
  /** Conexión de IA de la cuenta (`ai_credentials.id`). */
  readonly credentialId: string;
  readonly model: string;
  /** Instrucciones del asistente. */
  readonly system: string;
  /** Conversación previa (si se recuerda) + el mensaje actual al final. */
  readonly messages: ReadonlyArray<AiMessage>;
  /** Pedir la respuesta como un objeto JSON (clasificar intención). */
  readonly json: boolean;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
}

export interface AiUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/**
 * Por qué no hubo respuesta:
 *   credential_not_found  la conexión no existe (borrada) o es de otra cuenta
 *   invalid_key           el proveedor rechazó la clave
 *   quota_exceeded        sin saldo o cuota en la cuenta del proveedor
 *   rate_limited          demasiadas peticiones; reintentar luego
 *   model_not_found       el modelo no existe o esa cuenta no tiene acceso
 *   content_filtered      el proveedor bloqueó el contenido
 *   timeout · network_error · provider_error
 *   unavailable           este entorno no llama a modelos (tests)
 */
export type AiFailureReason =
  | "credential_not_found"
  | "invalid_key"
  | "quota_exceeded"
  | "rate_limited"
  | "model_not_found"
  | "content_filtered"
  | "timeout"
  | "network_error"
  | "provider_error"
  | "unavailable";

export type AiGenerateResult =
  | { readonly ok: true; readonly text: string; readonly usage?: AiUsage }
  | { readonly ok: false; readonly reason: AiFailureReason; readonly message: string };

export interface AiGateway {
  generate(tenantId: string, request: AiGenerateRequest): Promise<AiGenerateResult>;
}
