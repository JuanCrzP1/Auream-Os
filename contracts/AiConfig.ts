import { readBoolean, readInteger, readItems, readString } from "./ConfigReaders";

// ---------------------------------------------------------------------------
// Extensión IA — contrato de configuración compartido por el builder (editor)
// y el motor (AiNodeHandler).
//
// El bloque NO guarda claves: usa una conexión de IA de la cuenta
// (`credentialId`), que trae el proveedor y la clave cifrada. Las versiones
// anteriores guardaban `provider` y `apiKey` aquí; se ignoran al leer y la
// clave se borra al cargar o guardar el flujo.
// ---------------------------------------------------------------------------

export const AI_MAX_CONTEXT_TURNS = 20;
export const AI_MAX_INTENTS = 10;

/** Una intención: si el mensaje encaja con la descripción, sale por su camino. */
export interface AiIntent {
  readonly id: string;
  /** Cuándo aplica, en palabras del cliente: «pregunta por precios». */
  readonly description: string;
  /** Nombre de la salida (y lo que devuelve el modelo): `precios`. */
  readonly key: string;
}

export interface AiConfig {
  /** Conexión de IA de la cuenta. Vacío = sin configurar. */
  readonly credentialId: string;
  readonly model: string;
  /** Instrucciones y rol del asistente. */
  readonly systemPrompt: string;
  /** Lo que se le pasa al modelo: normalmente una variable. */
  readonly userMessage: string;
  readonly responseVariable: string;
  readonly errorVariable: string;
  readonly keepContext: boolean;
  readonly contextTurns: number;
  readonly understandAudio: boolean;
  readonly understandImage: boolean;
  readonly understandPdf: boolean;
  /** Enviar la respuesta al cliente automáticamente. */
  readonly autoSend: boolean;
  readonly intents: ReadonlyArray<AiIntent>;
  /** Clave de la salida cuando ninguna intención encaja. */
  readonly fallbackKey: string;
}

export const AI_DEFAULT_CONFIG: AiConfig = {
  credentialId: "",
  model: "",
  systemPrompt: "",
  userMessage: "{last_message}",
  responseVariable: "ia.respuesta",
  errorVariable: "ia.error",
  keepContext: false,
  contextTurns: 5,
  understandAudio: false,
  understandImage: false,
  understandPdf: false,
  autoSend: true,
  intents: [],
  fallbackKey: "otro"
};

export function readAiConfig(config: Readonly<Record<string, unknown>>): AiConfig {
  const d = AI_DEFAULT_CONFIG;
  return {
    credentialId: readString(config["credentialId"]).trim(),
    model: readString(config["model"]).trim(),
    systemPrompt: readString(config["systemPrompt"]),
    userMessage: readString(config["userMessage"], d.userMessage),
    responseVariable: readString(config["responseVariable"], d.responseVariable).trim(),
    errorVariable: readString(config["errorVariable"], d.errorVariable).trim(),
    keepContext: readBoolean(config["keepContext"]),
    contextTurns: readInteger(config["contextTurns"], d.contextTurns, 1, AI_MAX_CONTEXT_TURNS),
    understandAudio: readBoolean(config["understandAudio"]),
    understandImage: readBoolean(config["understandImage"]),
    understandPdf: readBoolean(config["understandPdf"]),
    autoSend: readBoolean(config["autoSend"], d.autoSend),
    intents: readItems(config["intents"], "intent", (record, id) => ({
      id,
      description: readString(record["description"]),
      key: readString(record["key"]).trim()
    })).slice(0, AI_MAX_INTENTS),
    fallbackKey: readString(config["fallbackKey"], d.fallbackKey).trim()
  };
}

/** Ids persistidos de las salidas fijas. Con intenciones, cada una sale por su `id`. */
export const AI_OUTPUT = { success: "success", failure: "failure", fallback: "fallback" } as const;

/** Clave con la que el modelo nombra una intención (la escrita, o una por posición). */
export function intentKeyOf(intent: AiIntent, index: number): string {
  return intent.key || `intencion_${index + 1}`;
}

/** Campos que no deben vivir en un bloque guardado (versiones anteriores). */
export const AI_LEGACY_SECRET_FIELDS = ["apiKey", "provider"] as const;
