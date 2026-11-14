import { AI_OUTPUT, intentKeyOf, type AiConfig } from "../../../contracts/AiConfig";
import { renderTemplate, type VariableResolver } from "../../../contracts/TemplateVariables";
import type { AiFailureReason, AiGateway, AiMessage, AiUsage } from "../../ports/AiGateway";
import type { AiMediaInput } from "./aiMedia";
import { intentInstructions, parseIntentReply } from "./aiIntentProtocol";

// ---------------------------------------------------------------------------
// Una ejecución del bloque de IA: preparar → llamar → interpretar. La usan el
// bloque en un flujo y «Probar» del editor (a través de la API): las dos
// rutas hacen exactamente lo mismo.
// ---------------------------------------------------------------------------

export const AI_LIMITS = { maxOutputTokens: 4096, timeoutMs: 45_000, maxMessageLength: 8000 } as const;

export type AiStepFailure = AiFailureReason | "not_configured" | "empty_message" | "media_unreadable";

export interface AiStepResult {
  readonly succeeded: boolean;
  readonly reason?: AiStepFailure;
  readonly message?: string;
  /** Lo que se le envía (o se guarda) para el cliente. */
  readonly reply: string;
  /** Salida por la que sigue el flujo. */
  readonly output: string;
  /** Clave de la intención reconocida, si hay clasificación. */
  readonly intentKey: string | null;
  /** El modelo no devolvió el JSON de clasificación. */
  readonly unparsed: boolean;
  /** Mensaje que recibió el modelo, ya con variables (o lo que mandó el cliente: «(nota de voz)»). */
  readonly userMessage: string;
  /** Qué archivo del cliente vio u oyó la IA. */
  readonly mediaKind?: AiMediaInput["kind"];
  readonly mediaEvents?: ReadonlyArray<string>;
  readonly usage?: AiUsage;
  readonly durationMs: number;
  readonly missingVariables: ReadonlyArray<string>;
}

export interface AiStepInput {
  readonly tenantId: string;
  readonly resolve: VariableResolver;
  /** Conversación previa con este bloque (vacía si no se recuerda). */
  readonly history: ReadonlyArray<AiMessage>;
  /** Audio, foto o PDF del cliente (casillas del bloque). Sin esto, solo texto. */
  readonly media?: (rendered: string) => Promise<AiMediaInput>;
}

const MEDIA_NOTE = { audio: "(nota de voz)", image: "(imagen)", pdf: "(PDF)" } as const;

function failed(reason: AiStepFailure, message: string, extra: Partial<AiStepResult> = {}): AiStepResult {
  return { succeeded: false, reason, message, reply: "", output: AI_OUTPUT.failure, intentKey: null, unparsed: false, userMessage: "", durationMs: 0, missingVariables: [], ...extra };
}

export async function runAiStep(config: AiConfig, input: AiStepInput, ai: AiGateway, clock: () => number = Date.now): Promise<AiStepResult> {
  if (!config.credentialId || !config.model) {
    return failed("not_configured", "El bloque de IA no tiene una conexión y un modelo elegidos.");
  }

  const user = renderTemplate(config.userMessage, input.resolve);
  const system = renderTemplate(config.systemPrompt, input.resolve);
  const missingVariables = [...new Set([...user.missing, ...system.missing])];
  const media: AiMediaInput = input.media ? await input.media(user.text) : { text: user.text, attachments: [], events: [] };
  const mediaInfo = { ...(media.kind ? { mediaKind: media.kind } : {}), mediaEvents: media.events };
  if (media.failure) return failed("media_unreadable", media.failure, { missingVariables, ...mediaInfo });
  const text = media.text.trim().slice(0, AI_LIMITS.maxMessageLength);
  if (!text && media.attachments.length === 0) {
    return failed("empty_message", "No hay mensaje para la IA (la variable llegó vacía).", { missingVariables, ...mediaInfo });
  }
  // Lo que queda en el historial y en «Probar»: el texto, o qué mandó el cliente.
  const userMessage = [media.kind && media.kind !== "pdf" ? MEDIA_NOTE[media.kind] : "", text].filter(Boolean).join(" ");

  const classifying = config.intents.length > 0;
  const started = clock();
  const result = await ai.generate(input.tenantId, {
    credentialId: config.credentialId,
    model: config.model,
    system: [system.text.trim(), classifying ? intentInstructions(config.intents, config.fallbackKey) : ""].filter(Boolean).join("\n\n"),
    messages: [...input.history, { role: "user", content: text, ...(media.attachments.length > 0 ? { attachments: media.attachments } : {}) }],
    json: classifying,
    maxOutputTokens: AI_LIMITS.maxOutputTokens,
    timeoutMs: AI_LIMITS.timeoutMs
  });
  const durationMs = clock() - started;

  if (!result.ok) return failed(result.reason, result.message, { userMessage, durationMs, missingVariables, ...mediaInfo });

  const usage = { ...(result.usage ? { usage: result.usage } : {}), ...mediaInfo };
  if (!classifying) {
    return { succeeded: true, reply: result.text, output: AI_OUTPUT.success, intentKey: null, unparsed: false, userMessage, durationMs, missingVariables, ...usage };
  }

  const parsed = parseIntentReply(result.text, config.intents);
  return {
    succeeded: true,
    reply: parsed.reply,
    output: parsed.intent ? parsed.intent.id : AI_OUTPUT.fallback,
    intentKey: parsed.intent ? intentKeyOf(parsed.intent, config.intents.indexOf(parsed.intent)) : config.fallbackKey || "otro",
    unparsed: parsed.unparsed,
    userMessage,
    durationMs,
    missingVariables,
    ...usage
  };
}
