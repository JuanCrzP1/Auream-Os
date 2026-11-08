import type { ToolData, ToolOutput } from "../ToolDefinition";
import type { Option } from "../_kit/fields";
import { readBoolean, readEnum, readInteger, readItems, readString } from "../_kit/read";

// ---------------------------------------------------------------------------
// Extensión IA: llama a un modelo con el mensaje del cliente e instrucciones,
// guarda la respuesta en una variable y, opcionalmente, clasifica la intención
// (cada intención es una salida).
// ---------------------------------------------------------------------------

export const AI_PROVIDERS = ["gpt", "gemini", "openrouter"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_PROVIDER_OPTIONS: ReadonlyArray<Option<AiProvider>> = [
  { value: "gpt", label: "OpenAI (GPT)" },
  { value: "gemini", label: "Google (Gemini)" },
  { value: "openrouter", label: "OpenRouter" }
];

export const AI_MODELS: Readonly<Record<AiProvider, ReadonlyArray<Option<string>>>> = {
  gpt: [
    { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { value: "gpt-5.4", label: "GPT-5.4" },
    { value: "gpt-5.4-nano", label: "GPT-5.4 Nano" },
    { value: "gpt-5", label: "GPT-5" },
    { value: "gpt-5-mini", label: "GPT-5 Mini" }
  ],
  gemini: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" }
  ],
  openrouter: [
    { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
    { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
    { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" }
  ]
};

export const AI_MAX_CONTEXT_TURNS = 20;
export const AI_MAX_INTENTS = 10;

/** Una intención: si el mensaje encaja con la descripción, sale por `key`. */
export interface AiIntent {
  readonly id: string;
  readonly description: string;
  readonly key: string;
}

export interface AiConfig {
  readonly provider: AiProvider;
  readonly model: string;
  readonly apiKey: string;
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
  /** Salida cuando ninguna intención encaja. */
  readonly fallbackKey: string;
}

export const AI_DEFAULT_CONFIG: AiConfig = {
  provider: "gpt",
  model: "gpt-5.4-mini",
  apiKey: "",
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

export function readAiConfig(config: ToolData): AiConfig {
  const d = AI_DEFAULT_CONFIG;
  const provider = readEnum(config.provider, AI_PROVIDERS, d.provider);
  const models = AI_MODELS[provider].map((model) => model.value);

  return {
    provider,
    model: readEnum(config.model, models, models[0]),
    apiKey: readString(config.apiKey),
    systemPrompt: readString(config.systemPrompt),
    userMessage: readString(config.userMessage, d.userMessage),
    responseVariable: readString(config.responseVariable, d.responseVariable).trim(),
    errorVariable: readString(config.errorVariable, d.errorVariable).trim(),
    keepContext: readBoolean(config.keepContext),
    contextTurns: readInteger(config.contextTurns, d.contextTurns, 1, AI_MAX_CONTEXT_TURNS),
    understandAudio: readBoolean(config.understandAudio),
    understandImage: readBoolean(config.understandImage),
    understandPdf: readBoolean(config.understandPdf),
    autoSend: readBoolean(config.autoSend, d.autoSend),
    intents: readItems(config.intents, "intent", (record, id) => ({
      id,
      description: readString(record.description),
      key: readString(record.key).trim()
    })),
    fallbackKey: readString(config.fallbackKey, d.fallbackKey).trim()
  };
}

export const AI_OUTPUT = { success: "success", failure: "failure", fallback: "fallback" } as const;

/** Con intenciones: una salida por intención + «sin coincidencia» + error. Sin ellas: respuesta + error. */
export function aiOutputs(config: ToolData): ReadonlyArray<ToolOutput> {
  const read = readAiConfig(config);
  const failure = { id: AI_OUTPUT.failure, label: "Error" };

  if (read.intents.length === 0) return [{ id: AI_OUTPUT.success, label: "Respuesta" }, failure];

  return [
    ...read.intents.map((intent, index) => ({ id: intent.id, label: intent.key || `Intención ${index + 1}` })),
    { id: AI_OUTPUT.fallback, label: read.fallbackKey || "Sin coincidencia" },
    failure
  ];
}
