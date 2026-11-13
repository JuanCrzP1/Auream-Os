// ---------------------------------------------------------------------------
// Configuración de «Esperar respuesta» (nodo `question`).
//
// Vive en `contracts/` porque la leen las dos orillas: el editor del builder la
// escribe y `QuestionNodeHandler` la ejecuta. Puro: sin React ni Node.
//
// `content.text` (el mensaje previo) no está aquí: es contenido del nodo, no
// configuración.
// ---------------------------------------------------------------------------

/** Sin segundos (no es una espera humana real) ni días (exigen huso horario). */
export type WaitResponseTimeUnit = "minutes" | "hours";

export interface WaitResponseTimeout {
  readonly amount: number;
  readonly unit: WaitResponseTimeUnit;
}

export interface WaitResponseConfig {
  /** Sin caducidad: la sesión despierta con el siguiente mensaje del cliente. */
  readonly waitIndefinitely: boolean;

  /** Solo con `waitIndefinitely: false`. Su ausencia en ese caso es inválida. */
  readonly timeout?: WaitResponseTimeout;

  /**
   * Tratar mensajes seguidos como una respuesta. Modelado; el búfer de entrada
   * que lo ejecuta es Fase C. El handler lo declara en `nodeResult`.
   */
  readonly groupMessages: boolean;

  /** Citar el último mensaje del cliente (`OutboundMessage.replyToMessageId`). */
  readonly replyToInbound: boolean;

  /** Emoji con el que reaccionar a la respuesta. Ausente = no se reacciona. */
  readonly reaction?: string;

  /**
   * Campo de contexto donde guardar la respuesta, sin prefijo `context.`.
   * Se mantiene el nombre `targetKey` por compatibilidad con nodos guardados.
   */
  readonly targetKey?: string;

  /**
   * Si `targetKey` es un campo del cliente con tipo (lista, número, fecha, sí
   * o no) y la respuesta no encaja: `retry` vuelve a preguntar, hasta
   * `WAIT_RESPONSE_MAX_RETRIES` veces; después sigue y lo que escribió queda
   * solo en la conversación. Ausente: sigue igual desde la primera.
   */
  readonly onMismatch?: "retry";

  /** Lo que se le escribe al volver a preguntar. Ausente: el mensaje según el tipo (`mismatchMessage`). */
  readonly retryMessage?: string;
}

/** Cuántas veces se vuelve a preguntar si la respuesta no encaja en el tipo del campo. */
export const WAIT_RESPONSE_MAX_RETRIES = 2;

/** Dónde lleva la cuenta de intentos la conversación (interno: `__` no pasa a la ficha). */
export const waitResponseRetryKey = (nodeId: string) => `__retry.${nodeId}`;

export const WAIT_RESPONSE_DEFAULT_TIMEOUT: WaitResponseTimeout = {
  amount: 30,
  unit: "minutes"
};

/**
 * Estado de un nodo NUEVO: decisión de producto (editor con el tiempo máximo
 * listo). Difiere a propósito del fallback de `readWaitResponseConfig` para
 * datos ausentes, que no inventa un límite que nadie escribió.
 *
 * El motor aún no hace vencer timeouts (Fase C): los declara en `nodeResult`.
 */
export const WAIT_RESPONSE_DEFAULT_CONFIG: WaitResponseConfig = {
  waitIndefinitely: false,
  timeout: WAIT_RESPONSE_DEFAULT_TIMEOUT,
  groupMessages: false,
  replyToInbound: false
};

const MS_PER_UNIT: Readonly<Record<WaitResponseTimeUnit, number>> = {
  minutes: 60_000,
  hours: 3_600_000
};

export function isWaitResponseTimeUnit(unit: unknown): unit is WaitResponseTimeUnit {
  return unit === "minutes" || unit === "hours";
}

/** Entera y positiva: ningún control produce «2,5 horas». */
export function isWaitResponseAmount(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isInteger(amount) && amount > 0;
}

/**
 * Lee la configuración sin confiar en ella (JSON de disco). Lo corrupto cae a
 * un valor seguro; señalarlo es trabajo de la validación.
 *
 * Solo un `false` explícito quita el «sin límite». El destino se normaliza al
 * leer para que editor, resumen, nodo y motor vean la misma clave.
 */
export function readWaitResponseConfig(config: Readonly<Record<string, unknown>>): WaitResponseConfig {
  const rawTimeout = config.timeout;
  const timeout =
    typeof rawTimeout === "object" && rawTimeout !== null
      ? (rawTimeout as Record<string, unknown>)
      : null;

  const amount = timeout?.amount;
  const unit = timeout?.unit;
  const targetKey = resolveContextKey(config.targetKey) ?? "";
  const reaction = typeof config.reaction === "string" ? config.reaction.trim() : "";
  const retryMessage = typeof config.retryMessage === "string" ? config.retryMessage.trim() : "";

  return {
    waitIndefinitely: config.waitIndefinitely !== false,
    ...(isWaitResponseAmount(amount) && isWaitResponseTimeUnit(unit) ? { timeout: { amount, unit } } : {}),
    groupMessages: config.groupMessages === true,
    replyToInbound: config.replyToInbound === true,
    ...(reaction.length > 0 ? { reaction } : {}),
    ...(targetKey.length > 0 ? { targetKey } : {}),
    ...(config.onMismatch === "retry" ? { onMismatch: "retry" as const } : {}),
    ...(retryMessage.length > 0 ? { retryMessage } : {})
  };
}

/** Espera máxima en ms, o `null` sin límite. Única aritmética para motor y editor. */
export function waitResponseTimeoutMs(config: WaitResponseConfig): number | null {
  if (config.waitIndefinitely || !config.timeout) return null;

  return config.timeout.amount * MS_PER_UNIT[config.timeout.unit];
}

/**
 * Normaliza la clave de contexto: acepta `nombre` y `context.nombre` y devuelve
 * la forma sin prefijo, que es la que resuelven `EdgeEvaluator` y `{{context.x}}`.
 */
export function resolveContextKey(targetKey: unknown): string | null {
  if (typeof targetKey !== "string" || targetKey.trim().length === 0) {
    return null;
  }

  return targetKey.trim().replace(/^context\./, "");
}

/**
 * Ids de las salidas del nodo. Son DATO persistido (`fromOutput` de la arista),
 * no rótulos: cambiar un valor desconecta las aristas guardadas.
 */
export const WAIT_RESPONSE_OUTPUT = {
  answer: "respuesta",
  timeout: "tiempo-agotado"
} as const;

/** `true` si la espera puede vencer y, por tanto, existe la salida de timeout. */
export function hasWaitResponseTimeout(config: WaitResponseConfig): boolean {
  return waitResponseTimeoutMs(config) !== null;
}
