import type { AiModelOption } from "../../contracts/AiContracts";
import type { AiKeyCheck, AiModelList } from "../../domains/integrations/application/ports/AiProviderAccess";
import type { AiGenerateResult } from "../../flow-engine/ports/AiGateway";
import type { AiChatRequest, AiProviderClient, FetchLike } from "./AiProviderClient";
import { failureFromStatus, prettifyModelId, providerMessage, requestJson } from "./aiHttp";

// ---------------------------------------------------------------------------
// Google Gemini (API de Generative Language). La clave va en cabecera, nunca
// en la URL: las URLs acaban en registros.
// ---------------------------------------------------------------------------

const LIST_TIMEOUT_MS = 15_000;

interface GenerateResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export class GeminiClient implements AiProviderClient {
  public readonly id = "gemini" as const;
  private readonly fetchImpl: FetchLike;

  public constructor(fetchImpl?: FetchLike, private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta") {
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init));
  }

  private headers(apiKey: string): Record<string, string> {
    return { "x-goog-api-key": apiKey, "content-type": "application/json" };
  }

  public async chat(request: AiChatRequest): Promise<AiGenerateResult> {
    const model = request.model.replace(/^models\//, "");
    const body = {
      ...(request.system ? { systemInstruction: { parts: [{ text: request.system }] } } : {}),
      contents: request.messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        // La foto o la nota de voz del cliente van junto al texto: Gemini las ve y las oye.
        parts: [
          ...(message.content || !message.attachments?.length ? [{ text: message.content }] : []),
          ...(message.attachments ?? []).map((attachment) => ({ inline_data: { mime_type: attachment.mimeType, data: attachment.data } }))
        ]
      })),
      generationConfig: { maxOutputTokens: request.maxOutputTokens, ...(request.json ? { responseMimeType: "application/json" } : {}) }
    };
    const result = await requestJson(
      this.fetchImpl,
      `${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
      { method: "POST", headers: this.headers(request.apiKey), body: JSON.stringify(body) },
      request.timeoutMs
    );
    if (!result.ok) return result;
    if (result.status < 200 || result.status >= 300) return { ok: false, ...failureFromStatus(result.status, result.body) };

    const response = result.body as GenerateResponse;
    const candidate = response.candidates?.[0];
    if (response.promptFeedback?.blockReason || candidate?.finishReason === "SAFETY" || candidate?.finishReason === "PROHIBITED_CONTENT") {
      return { ok: false, reason: "content_filtered", message: "Google bloqueó la respuesta por su política de contenido." };
    }
    const text = (candidate?.content?.parts ?? [])
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
    if (!text) return { ok: false, reason: "provider_error", message: providerMessage(result.body) || "El modelo no devolvió texto." };
    return {
      ok: true,
      text,
      ...(response.usageMetadata
        ? { usage: { inputTokens: response.usageMetadata.promptTokenCount ?? 0, outputTokens: response.usageMetadata.candidatesTokenCount ?? 0 } }
        : {})
    };
  }

  public async verifyKey(apiKey: string): Promise<AiKeyCheck> {
    const result = await requestJson(this.fetchImpl, `${this.baseUrl}/models?pageSize=1`, { headers: this.headers(apiKey) }, LIST_TIMEOUT_MS);
    if (!result.ok) return { ok: false, reason: "unavailable", message: result.message };
    if (result.status >= 200 && result.status < 300) return { ok: true };
    const failure = failureFromStatus(result.status, result.body);
    // Google responde 400 «API key not valid» a una clave mala.
    return failure.reason === "invalid_key" || result.status === 400
      ? { ok: false, reason: "invalid_key", message: failure.message }
      : { ok: false, reason: "unavailable", message: failure.message };
  }

  public async listModels(apiKey: string): Promise<AiModelList> {
    const result = await requestJson(this.fetchImpl, `${this.baseUrl}/models?pageSize=1000`, { headers: this.headers(apiKey) }, LIST_TIMEOUT_MS);
    if (!result.ok) return { ok: false, reason: "unavailable", message: result.message };
    if (result.status < 200 || result.status >= 300) {
      const failure = failureFromStatus(result.status, result.body);
      return { ok: false, reason: failure.reason === "invalid_key" ? "invalid_key" : "unavailable", message: failure.message };
    }
    const list = (result.body as { models?: Array<{ name?: unknown; displayName?: unknown; supportedGenerationMethods?: unknown }> } | null)?.models ?? [];
    const models: AiModelOption[] = list
      .filter((model) => typeof model.name === "string" && model.name.includes("gemini"))
      .filter((model) => Array.isArray(model.supportedGenerationMethods) && model.supportedGenerationMethods.includes("generateContent"))
      .map((model) => {
        const id = (model.name as string).replace(/^models\//, "");
        return { id, label: typeof model.displayName === "string" && model.displayName ? model.displayName : prettifyModelId(id) };
      })
      .sort((a, b) => b.id.localeCompare(a.id));
    return { ok: true, models };
  }
}
