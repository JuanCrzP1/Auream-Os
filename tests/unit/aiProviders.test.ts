import { describe, expect, it } from "vitest";
import { createOpenAiClient, createOpenRouterClient } from "../../infrastructure/ai/OpenAiCompatibleClient.js";
import { GeminiClient } from "../../infrastructure/ai/GeminiClient.js";
import { scrubSecrets } from "../../infrastructure/ai/aiHttp.js";
import type { FetchLike } from "../../infrastructure/ai/AiProviderClient.js";

// ---------------------------------------------------------------------------
// Clientes de OpenAI, Gemini y OpenRouter contra una red falsa: forma de la
// petición (la clave en cabecera, nunca en la URL), lectura de la respuesta y
// traducción de errores a motivos claros.
// ---------------------------------------------------------------------------

interface Call {
  url: string;
  init: RequestInit;
}

function network(status: number, body: unknown) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init = {}) => {
    calls.push({ url, init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  };
  return { calls, fetchImpl };
}

const KEY = "sk-test-clave-super-secreta-123456";
const chat = { apiKey: KEY, model: "gpt-5.4-mini", system: "Eres amable.", messages: [{ role: "user" as const, content: "Hola" }], json: false, maxOutputTokens: 500, timeoutMs: 1000 };

describe("OpenAI", () => {
  it("envía Chat Completions con instrucciones, mensajes y límite, y lee el texto y el uso", async () => {
    const net = network(200, { choices: [{ message: { content: " ¡Hola! " }, finish_reason: "stop" }], usage: { prompt_tokens: 12, completion_tokens: 3 } });
    const result = await createOpenAiClient(net.fetchImpl).chat({ ...chat, json: true });

    expect(result).toEqual({ ok: true, text: "¡Hola!", usage: { inputTokens: 12, outputTokens: 3 } });
    expect(net.calls[0]!.url).toBe("https://api.openai.com/v1/chat/completions");
    expect((net.calls[0]!.init.headers as Record<string, string>)["authorization"]).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(String(net.calls[0]!.init.body))).toEqual({
      model: "gpt-5.4-mini",
      messages: [{ role: "system", content: "Eres amable." }, { role: "user", content: "Hola" }],
      max_completion_tokens: 500,
      response_format: { type: "json_object" }
    });
  });

  it.each([
    [401, { error: { message: `Incorrect API key provided: ${KEY}`, code: "invalid_api_key" } }, "invalid_key"],
    [429, { error: { message: "You exceeded your current quota", code: "insufficient_quota" } }, "quota_exceeded"],
    [429, { error: { message: "Rate limit reached" } }, "rate_limited"],
    [404, { error: { message: "The model does not exist", code: "model_not_found" } }, "model_not_found"],
    [500, { error: { message: "boom" } }, "provider_error"]
  ])("HTTP %i → %s, sin filtrar la clave", async (status, body, reason) => {
    const result = await createOpenAiClient(network(status, body).fetchImpl).chat(chat);
    expect(result.ok ? null : result.reason).toBe(reason);
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it("contenido bloqueado y respuesta vacía son fallos explícitos", async () => {
    const filtered = await createOpenAiClient(network(200, { choices: [{ message: { content: "" }, finish_reason: "content_filter" }] }).fetchImpl).chat(chat);
    const empty = await createOpenAiClient(network(200, { choices: [{ message: { content: "" } }] }).fetchImpl).chat(chat);
    expect([filtered.ok ? null : filtered.reason, empty.ok ? null : empty.reason]).toEqual(["content_filtered", "provider_error"]);
  });

  it("lista solo modelos de conversación y verifica la clave con /models", async () => {
    const net = network(200, { data: [{ id: "gpt-5.4-mini" }, { id: "text-embedding-3-small" }, { id: "gpt-4o-realtime-preview" }, { id: "o4-mini" }, { id: "dall-e-3" }] });
    const models = await createOpenAiClient(net.fetchImpl).listModels(KEY);
    expect(models.ok && models.models).toEqual([{ id: "o4-mini", label: "O4 Mini" }, { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" }]);
    expect(await createOpenAiClient(network(401, {}).fetchImpl).verifyKey(KEY)).toMatchObject({ ok: false, reason: "invalid_key" });
    expect(await createOpenAiClient(network(503, {}).fetchImpl).verifyKey(KEY)).toMatchObject({ ok: false, reason: "unavailable" });
  });

  it("sin respuesta a tiempo → timeout", async () => {
    const slow: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("t"), { name: "TimeoutError" }))));
    const result = await createOpenAiClient(slow).chat({ ...chat, timeoutMs: 20 });
    expect(result.ok ? null : result.reason).toBe("timeout");
  });
});

describe("OpenRouter", () => {
  it("usa su dirección, max_tokens y comprueba la clave con /key (su /models es público)", async () => {
    const net = network(200, { choices: [{ message: { content: "ok" } }] });
    await createOpenRouterClient(net.fetchImpl).chat({ ...chat, model: "anthropic/claude-sonnet-4" });
    expect(net.calls[0]!.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(JSON.parse(String(net.calls[0]!.init.body)).max_tokens).toBe(500);

    const verify = network(200, { data: {} });
    await createOpenRouterClient(verify.fetchImpl).verifyKey(KEY);
    expect(verify.calls[0]!.url).toBe("https://openrouter.ai/api/v1/key");
  });

  it("402 (sin créditos) → quota_exceeded", async () => {
    const result = await createOpenRouterClient(network(402, { error: { message: "Insufficient credits" } }).fetchImpl).chat(chat);
    expect(result.ok ? null : result.reason).toBe("quota_exceeded");
  });
});

describe("Gemini", () => {
  it("generateContent con la clave en cabecera, roles user/model e instrucciones de sistema", async () => {
    const net = network(200, { candidates: [{ content: { parts: [{ text: "Hola " }, { text: "Laura" }] } }], usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 2 } });
    const result = await new GeminiClient(net.fetchImpl).chat({
      ...chat,
      model: "models/gemini-2.5-flash",
      json: true,
      messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }, { role: "user", content: "c" }]
    });

    expect(result).toEqual({ ok: true, text: "Hola Laura", usage: { inputTokens: 8, outputTokens: 2 } });
    expect(net.calls[0]!.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    expect(net.calls[0]!.url).not.toContain(KEY);
    expect((net.calls[0]!.init.headers as Record<string, string>)["x-goog-api-key"]).toBe(KEY);
    const body = JSON.parse(String(net.calls[0]!.init.body));
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model", "user"]);
    expect(body.systemInstruction).toEqual({ parts: [{ text: "Eres amable." }] });
    expect(body.generationConfig).toEqual({ maxOutputTokens: 500, responseMimeType: "application/json" });
  });

  it("clave inválida (400 de Google), bloqueo de seguridad y lista de modelos", async () => {
    const invalid = await new GeminiClient(network(400, { error: { message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } }).fetchImpl).verifyKey(KEY);
    expect(invalid).toMatchObject({ ok: false, reason: "invalid_key" });

    const blocked = await new GeminiClient(network(200, { promptFeedback: { blockReason: "SAFETY" } }).fetchImpl).chat(chat);
    expect(blocked.ok ? null : blocked.reason).toBe("content_filtered");

    const list = await new GeminiClient(
      network(200, {
        models: [
          { name: "models/gemini-2.5-flash", displayName: "Gemini 2.5 Flash", supportedGenerationMethods: ["generateContent"] },
          { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
          { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] }
        ]
      }).fetchImpl
    ).listModels(KEY);
    expect(list.ok && list.models).toEqual([{ id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" }]);
  });
});

it("scrubSecrets oculta lo que parezca una clave", () => {
  expect(scrubSecrets("Incorrect API key provided: sk-proj-abc123XYZ789. AIzaSyA1234567890abcdef")).toBe("Incorrect API key provided: [clave oculta]. [clave oculta]");
});
