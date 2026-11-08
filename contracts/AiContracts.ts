// ---------------------------------------------------------------------------
// Conexiones de IA — contratos compartidos por la API y el frontend.
//
// La clave de API de un proveedor se guarda cifrada en la cuenta y NUNCA
// vuelve al navegador: solo su pista (`••••3f9a`). Los bloques de IA guardan
// el id de la conexión, no la clave.
// ---------------------------------------------------------------------------

export const AI_PROVIDER_IDS = ["openai", "gemini", "openrouter"] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export interface AiProviderInfo {
  readonly id: AiProviderId;
  readonly name: string;
  /** Dónde consigue el cliente su clave. */
  readonly keysUrl: string;
  /** Cómo empiezan sus claves, para orientar (no se valida por esto). */
  readonly keyPlaceholder: string;
}

export const AI_PROVIDERS: ReadonlyArray<AiProviderInfo> = [
  { id: "openai", name: "OpenAI", keysUrl: "https://platform.openai.com/api-keys", keyPlaceholder: "sk-…" },
  { id: "gemini", name: "Google Gemini", keysUrl: "https://aistudio.google.com/app/apikey", keyPlaceholder: "AIza…" },
  { id: "openrouter", name: "OpenRouter", keysUrl: "https://openrouter.ai/keys", keyPlaceholder: "sk-or-…" }
];

export function aiProviderInfo(id: AiProviderId): AiProviderInfo {
  return AI_PROVIDERS.find((provider) => provider.id === id)!;
}

export type AiCredentialStatus = "active" | "invalid";

export interface AiCredentialSummary {
  readonly id: string;
  readonly provider: AiProviderId;
  readonly name: string;
  /** Últimos caracteres de la clave, para reconocerla: `••••3f9a`. */
  readonly hint: string;
  readonly status: AiCredentialStatus;
  readonly lastVerifiedAt: string | null;
  readonly createdAt: string;
}

export interface CreateAiCredentialRequest {
  readonly provider: AiProviderId;
  readonly name: string;
  readonly apiKey: string;
}

/** Renombrar y/o reemplazar la clave (se vuelve a verificar). */
export interface UpdateAiCredentialRequest {
  readonly name?: string;
  readonly apiKey?: string;
}

export interface AiModelOption {
  readonly id: string;
  readonly label: string;
}

export interface AiModelListResponse {
  readonly models: ReadonlyArray<AiModelOption>;
}

/**
 * Modelos sugeridos cuando no se puede pedir la lista al proveedor. La lista
 * real sale de la cuenta del cliente (`GET /ai-credentials/:id/models`).
 */
export const AI_SUGGESTED_MODELS: Readonly<Record<AiProviderId, ReadonlyArray<AiModelOption>>> = {
  openai: [
    { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { id: "gpt-5.4", label: "GPT-5.4" },
    { id: "gpt-5.4-nano", label: "GPT-5.4 Nano" },
    { id: "gpt-5-mini", label: "GPT-5 Mini" }
  ],
  gemini: [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" }
  ],
  openrouter: [
    { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
    { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
    { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" }
  ]
};
