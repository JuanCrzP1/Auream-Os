import type { AiModelOption, AiProviderId } from "../../contracts/AiContracts";
import type { AiKeyCheck, AiModelList } from "../../domains/integrations/application/ports/AiProviderAccess";
import type { AiGenerateResult } from "../../flow-engine/ports/AiGateway";
import type { AiChatRequest, AiProviderClient, FetchLike } from "./AiProviderClient";
import { failureFromStatus, prettifyModelId, providerMessage, requestJson } from "./aiHttp";

// ---------------------------------------------------------------------------
// OpenAI y OpenRouter hablan el mismo protocolo (Chat Completions). Cambian la
// dirección, cómo se comprueba una clave, qué modelos se listan y el nombre
// del límite de salida.
// ---------------------------------------------------------------------------

interface CompatibleOptions {
  readonly id: AiProviderId;
  readonly baseUrl: string;
  /** Ruta que responde 200 solo con una clave válida. */
  readonly verifyPath: string;
  readonly maxTokensParam: "max_completion_tokens" | "max_tokens";
  readonly extraHeaders?: Readonly<Record<string, string>>;
  readonly keepModel: (model: { id: string; name?: string }) => boolean;
  readonly fetchImpl?: FetchLike;
}

const LIST_TIMEOUT_MS = 15_000;
const MAX_MODELS = 400;

interface ChatCompletion {
  choices?: Array<{ message?: { content?: unknown }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenAiCompatibleClient implements AiProviderClient {
  public readonly id: AiProviderId;
  private readonly fetchImpl: FetchLike;

  public constructor(private readonly options: CompatibleOptions) {
    this.id = options.id;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  private headers(apiKey: string): Record<string, string> {
    return { authorization: `Bearer ${apiKey}`, "content-type": "application/json", ...this.options.extraHeaders };
  }

  public async chat(request: AiChatRequest): Promise<AiGenerateResult> {
    const body = {
      model: request.model,
      messages: [...(request.system ? [{ role: "system", content: request.system }] : []), ...request.messages],
      [this.options.maxTokensParam]: request.maxOutputTokens,
      ...(request.json ? { response_format: { type: "json_object" } } : {})
    };
    const result = await requestJson(
      this.fetchImpl,
      `${this.options.baseUrl}/chat/completions`,
      { method: "POST", headers: this.headers(request.apiKey), body: JSON.stringify(body) },
      request.timeoutMs
    );
    if (!result.ok) return result;
    if (result.status < 200 || result.status >= 300) return { ok: false, ...failureFromStatus(result.status, result.body) };

    const completion = result.body as ChatCompletion;
    const choice = completion.choices?.[0];
    if (choice?.finish_reason === "content_filter") {
      return { ok: false, reason: "content_filtered", message: "El proveedor bloqueó la respuesta por su política de contenido." };
    }
    const text = typeof choice?.message?.content === "string" ? choice.message.content.trim() : "";
    if (!text) {
      return { ok: false, reason: "provider_error", message: providerMessage(result.body) || "El modelo no devolvió texto." };
    }
    return {
      ok: true,
      text,
      ...(completion.usage ? { usage: { inputTokens: completion.usage.prompt_tokens ?? 0, outputTokens: completion.usage.completion_tokens ?? 0 } } : {})
    };
  }

  public async verifyKey(apiKey: string): Promise<AiKeyCheck> {
    const result = await requestJson(this.fetchImpl, `${this.options.baseUrl}${this.options.verifyPath}`, { headers: this.headers(apiKey) }, LIST_TIMEOUT_MS);
    if (!result.ok) return { ok: false, reason: "unavailable", message: result.message };
    if (result.status >= 200 && result.status < 300) return { ok: true };
    const failure = failureFromStatus(result.status, result.body);
    return failure.reason === "invalid_key"
      ? { ok: false, reason: "invalid_key", message: failure.message }
      : { ok: false, reason: "unavailable", message: failure.message };
  }

  public async listModels(apiKey: string): Promise<AiModelList> {
    const result = await requestJson(this.fetchImpl, `${this.options.baseUrl}/models`, { headers: this.headers(apiKey) }, LIST_TIMEOUT_MS);
    if (!result.ok) return { ok: false, reason: "unavailable", message: result.message };
    if (result.status < 200 || result.status >= 300) {
      const failure = failureFromStatus(result.status, result.body);
      return { ok: false, reason: failure.reason === "invalid_key" ? "invalid_key" : "unavailable", message: failure.message };
    }
    const data = (result.body as { data?: Array<{ id?: unknown; name?: unknown }> } | null)?.data ?? [];
    const models: AiModelOption[] = data
      .filter((model): model is { id: string; name?: string } => typeof model.id === "string")
      .filter(this.options.keepModel)
      .map((model) => ({ id: model.id, label: typeof model.name === "string" && model.name ? model.name : prettifyModelId(model.id) }))
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, MAX_MODELS);
    return { ok: true, models };
  }
}

/** Modelos de OpenAI que sirven para conversar (no audio, imágenes ni embeddings). */
export function isOpenAiChatModel(model: { id: string }): boolean {
  return /^(gpt-|o\d|chatgpt-)/.test(model.id) && !/(audio|realtime|transcribe|tts|image|embedding|search|instruct|moderation|dall-e|whisper)/.test(model.id);
}

export function createOpenAiClient(fetchImpl?: FetchLike, baseUrl = "https://api.openai.com/v1"): OpenAiCompatibleClient {
  return new OpenAiCompatibleClient({
    id: "openai",
    baseUrl,
    verifyPath: "/models",
    maxTokensParam: "max_completion_tokens",
    keepModel: isOpenAiChatModel,
    ...(fetchImpl ? { fetchImpl } : {})
  });
}

export function createOpenRouterClient(fetchImpl?: FetchLike, baseUrl = "https://openrouter.ai/api/v1"): OpenAiCompatibleClient {
  return new OpenAiCompatibleClient({
    id: "openrouter",
    baseUrl,
    // `/models` es público en OpenRouter: la clave se comprueba con `/key`.
    verifyPath: "/key",
    maxTokensParam: "max_tokens",
    extraHeaders: { "x-title": "Auream" },
    keepModel: () => true,
    ...(fetchImpl ? { fetchImpl } : {})
  });
}
