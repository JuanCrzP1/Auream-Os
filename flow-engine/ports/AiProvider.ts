// ---------------------------------------------------------------------------
// AiProvider — puerto
//
// Responsabilidad única: declarar qué necesita el nodo de IA de un proveedor,
// sin que el motor conozca ninguno.
//
//   AI Node → AiProvider (este puerto) → OpenAI | Gemini (infrastructure/providers)
//
// El motor NUNCA importa un SDK de proveedor. Las implementaciones viven en
// `infrastructure/providers/ai/` y las inyecta la composición.
//
// Estado: NO IMPLEMENTADO. No existe ninguna implementación de este puerto.
//
// BLOQUEO CONOCIDO: `NodeHandler.execute` es síncrono, por lo que este puerto
// asíncrono todavía no puede invocarse desde `AiNodeHandler`. Conectarlo exige
// convertir en asíncrona la cadena NodeHandler → NodeRuntime → ExecutionLoop
// → ExecutionOrchestrator. Esa decisión está pendiente y no se toma aquí.
// ---------------------------------------------------------------------------

/** Credencial resuelta por la plataforma; el motor nunca la almacena ni la registra. */
export interface AiCredential {
  readonly providerId: string;
  readonly apiKey: string;
}

export interface AiCompletionRequest {
  readonly credential: AiCredential;
  readonly model: string;
  readonly prompt: string;
  /** Únicamente las variables de contexto que el usuario autorizó en el nodo. */
  readonly allowedContext: Readonly<Record<string, unknown>>;
}

export interface AiCompletionResult {
  readonly text: string;
}

export interface AiProvider {
  /** Identificador estable del proveedor, p. ej. "openai" o "gemini". */
  readonly providerId: string;
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
