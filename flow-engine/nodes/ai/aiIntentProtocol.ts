import { intentKeyOf, type AiIntent } from "../../../contracts/AiConfig";

// ---------------------------------------------------------------------------
// Clasificar intención: se le pide al modelo un JSON `{intent, reply}` con una
// de las claves dadas, y se interpreta de forma tolerante (texto alrededor,
// mayúsculas). Una clave desconocida o una respuesta ilegible caen en la
// salida de respaldo: nunca se inventa un camino. Puro.
// ---------------------------------------------------------------------------

export function intentInstructions(intents: ReadonlyArray<AiIntent>, fallbackKey: string): string {
  const lines = intents.map((intent, index) => `- "${intentKeyOf(intent, index)}": ${intent.description.trim() || "(sin descripción)"}`);
  return [
    "## Clasificación (obligatoria)",
    "Clasifica el último mensaje del cliente en UNA de estas intenciones:",
    ...lines,
    `- "${fallbackKey || "otro"}": ninguna de las anteriores`,
    "Responde SOLO con un objeto JSON, sin texto antes ni después:",
    '{"intent": "<una de las claves>", "reply": "<tu respuesta para el cliente, siguiendo las instrucciones>"}'
  ].join("\n");
}

export interface ParsedIntentReply {
  /** Intención reconocida, o `null` = respaldo. */
  readonly intent: AiIntent | null;
  readonly reply: string;
  /** El modelo no devolvió el JSON pedido. */
  readonly unparsed: boolean;
}

function parseObject(text: string): Record<string, unknown> | null {
  const candidates = [text.trim(), /\{[\s\S]*\}/.exec(text)?.[0] ?? ""];
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate) as unknown;
      if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
    } catch {
      /* siguiente */
    }
  }
  return null;
}

const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/^["']|["']$/g, "");

export function parseIntentReply(text: string, intents: ReadonlyArray<AiIntent>): ParsedIntentReply {
  const object = parseObject(text);
  if (!object) {
    // Si no parece JSON, el texto sirve como respuesta; si lo parece, no se le envía al cliente.
    return { intent: null, reply: /^\s*[{[]/.test(text) ? "" : text.trim(), unparsed: true };
  }
  const said = typeof object["intent"] === "string" ? normalize(object["intent"]) : "";
  const intent = intents.find((candidate, index) => normalize(intentKeyOf(candidate, index)) === said) ?? null;
  const reply = typeof object["reply"] === "string" ? object["reply"].trim() : "";
  return { intent, reply, unparsed: false };
}
