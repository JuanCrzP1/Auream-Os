import { describe, expect, it } from "vitest";
import { AiNodeHandler } from "../../flow-engine/nodes/ai/AiNodeHandler.js";
import { historyKey } from "../../flow-engine/nodes/ai/aiHistory.js";
import { detectMediaType, prepareAiMedia, type AiMediaPorts } from "../../flow-engine/nodes/ai/aiMedia.js";
import { readAiConfig } from "../../contracts/AiConfig.js";
import type { AiGateway, AiGenerateRequest, AiGenerateResult } from "../../flow-engine/ports/AiGateway.js";
import type { FetchMediaRequest, FetchMediaResult } from "../../flow-engine/ports/MediaFetcher.js";
import type { DocumentInput, DocumentReadResult } from "../../flow-engine/ports/DocumentTextReader.js";
import { simulationDependencies } from "../../apps/api/composition/composeNodeRuntime.js";
import { createOpenAiClient, createOpenRouterClient } from "../../infrastructure/ai/OpenAiCompatibleClient.js";
import { GeminiClient } from "../../infrastructure/ai/GeminiClient.js";
import type { FetchLike } from "../../infrastructure/ai/AiProviderClient.js";
import type { FlowNode } from "../../contracts/FlowSnapshot.js";
import type { RuntimeInput, Session } from "../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// La IA oye notas de voz, ve fotos y lee PDF (casillas del bloque, como en
// Leona): el archivo del cliente se descarga, se reconoce por su firma y va
// al modelo en el formato de cada proveedor.
// ---------------------------------------------------------------------------

const OGG = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 2, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const HTML = new TextEncoder().encode("<!doctype html><html>");

function ports(files: Record<string, { bytes: Uint8Array; type: string }>, pdfText = "Factura 123 por $50"): AiMediaPorts & { fetched: string[] } {
  const fetched: string[] = [];
  return {
    fetched,
    fetcher: {
      async fetch(request: FetchMediaRequest): Promise<FetchMediaResult> {
        fetched.push(request.url);
        const file = files[request.url];
        return file ? { ok: true, media: { bytes: file.bytes, contentType: file.type } } : { ok: false, reason: "not_found", message: "respondió 404" };
      }
    },
    reader: {
      async read(document: DocumentInput): Promise<DocumentReadResult> {
        return document.contentType === "application/pdf" ? { ok: true, text: pdfText, method: "pdf-text" } : { ok: false, reason: "unsupported_type", message: "no" };
      }
    }
  };
}

const all = readAiConfig({ understandAudio: true, understandImage: true, understandPdf: true });
const AUDIO_URL = "https://files.example.com/nota.ogg";
const PHOTO_URL = "https://files.example.com/foto.jpg";

describe("prepareAiMedia", () => {
  it("la nota de voz que acaba de llegar va al modelo, en base64 y con su tipo real", async () => {
    const media = await prepareAiMedia(all, "ia", "", { mediaUrl: AUDIO_URL, mediaType: "application/octet-stream" }, ports({ [AUDIO_URL]: { bytes: OGG, type: "application/octet-stream" } }));
    expect(media).toMatchObject({ text: "", kind: "audio", attachments: [{ kind: "audio", mimeType: "audio/ogg", data: Buffer.from(OGG).toString("base64") }], events: ["ai_media_used:ia:audio"] });
  });

  it("una foto con texto: el texto sigue y la foto va aparte", async () => {
    const media = await prepareAiMedia(all, "ia", "¿Cuánto cuesta esto?", { mediaUrl: PHOTO_URL }, ports({ [PHOTO_URL]: { bytes: JPEG, type: "image/jpeg" } }));
    expect([media.text, media.attachments[0]?.mimeType, media.failure]).toEqual(["¿Cuánto cuesta esto?", "image/jpeg", undefined]);
  });

  it("el enlace que guardó «Esperar respuesta» ({respuesta}) se usa como el archivo y no se le manda como texto", async () => {
    const media = await prepareAiMedia(all, "ia", ` ${AUDIO_URL} `, {}, ports({ [AUDIO_URL]: { bytes: OGG, type: "audio/ogg" } }));
    expect([media.text, media.kind]).toEqual(["", "audio"]);
  });

  it("del PDF se lee el texto y se le agrega al mensaje", async () => {
    const url = "https://files.example.com/f.pdf";
    const media = await prepareAiMedia(all, "ia", "Mira", { mediaUrl: url }, ports({ [url]: { bytes: PDF, type: "application/pdf" } }));
    expect([media.text, media.attachments.length, media.kind]).toEqual(["Mira\n\nTexto del PDF que mandó el cliente:\nFactura 123 por $50", 0, "pdf"]);
  });

  it("con la casilla apagada y sin texto, explica cuál activar", async () => {
    const media = await prepareAiMedia(readAiConfig({ understandImage: true }), "ia", "", { mediaUrl: AUDIO_URL }, ports({ [AUDIO_URL]: { bytes: OGG, type: "audio/ogg" } }));
    expect(media.failure).toBe("El cliente mandó un audio y el bloque no tiene activado «Audios».");
    expect(media.events).toEqual(["ai_media_disabled:ia:audio"]);
  });

  it("un enlace escrito por el cliente que no es un archivo sigue como texto", async () => {
    const page = "https://tienda.example.com/producto";
    const media = await prepareAiMedia(all, "ia", page, {}, ports({ [page]: { bytes: HTML, type: "text/html" } }));
    expect([media.text, media.attachments.length, media.failure]).toEqual([page, 0, undefined]);
  });

  it("sin casillas activadas no descarga nada", async () => {
    const p = ports({ [AUDIO_URL]: { bytes: OGG, type: "audio/ogg" } });
    const media = await prepareAiMedia(readAiConfig({}), "ia", "", { mediaUrl: AUDIO_URL }, p);
    expect([media.attachments.length, p.fetched.length]).toEqual([0, 0]);
  });

  it("no se pudo descargar y no hay texto: falla con el motivo", async () => {
    const media = await prepareAiMedia(all, "ia", "", { mediaUrl: AUDIO_URL }, ports({}));
    expect(media.failure).toBe("No se pudo descargar el archivo del cliente: respondió 404");
  });

  it("reconoce los audios de WhatsApp y otros por su firma", () => {
    expect(detectMediaType(OGG)).toBe("audio/ogg");
    expect(detectMediaType(new Uint8Array([0x49, 0x44, 0x33, 3]))).toBe("audio/mpeg");
    expect(detectMediaType(new TextEncoder().encode("#!AMR\n"))).toBe("audio/amr");
    expect(detectMediaType(JPEG, "audio/ogg")).toBe("image/jpeg");
  });
});

class FakeAi implements AiGateway {
  public requests: AiGenerateRequest[] = [];
  public async generate(_tenantId: string, request: AiGenerateRequest): Promise<AiGenerateResult> {
    this.requests.push(request);
    return { ok: true, text: "¡Qué lindo mensaje!" };
  }
}

describe("AiNodeHandler con archivos", () => {
  const node = { id: "ia", type: "ai", name: "IA", content: {}, config: { credentialId: "c", model: "m", userMessage: "{last_message}", understandAudio: true, keepContext: true }, metadata: {} } as unknown as FlowNode;
  const input: RuntimeInput = {
    envelope: { tenantId: "t", flowKey: "f", channel: "whatsapp", conversationKey: "c", userKey: "1", messageId: "m", payload: { text: "", messageType: "audio", mediaUrl: AUDIO_URL, mediaType: "audio/ogg" }, receivedAt: "2026-11-14T00:00:00.000Z" },
    sessionContext: {},
    isWaitingInput: false,
    now: "2026-11-14T00:00:00.000Z",
    timezone: "UTC"
  };
  const session = { tenantId: "t", context: {} } as unknown as Session;

  it("oye la nota de voz aunque {last_message} llegue vacío, y lo anota en el resultado y el historial", async () => {
    const ai = new FakeAi();
    const result = await new AiNodeHandler(ai, simulationDependencies().contacts, ports({ [AUDIO_URL]: { bytes: OGG, type: "audio/ogg" } })).execute(node, input, session);

    expect(ai.requests[0]!.messages.at(-1)).toMatchObject({ role: "user", content: "", attachments: [{ kind: "audio", mimeType: "audio/ogg" }] });
    expect([result.output, result.nodeResult["media"]]).toEqual(["success", "audio"]);
    expect(result.domainEvents).toContain("ai_media_used:ia:audio");
    expect(result.contextPatch[historyKey("ia")]).toEqual([
      { role: "user", content: "(nota de voz)" },
      { role: "assistant", content: "¡Qué lindo mensaje!" }
    ]);
  });

  it("sin poder descargar el audio sale por Error con el motivo en la variable", async () => {
    const result = await new AiNodeHandler(new FakeAi(), simulationDependencies().contacts, ports({})).execute(node, input, session);
    expect([result.output, result.nodeResult["reason"]]).toEqual(["failure", "media_unreadable"]);
    expect(result.contextPatch["ia.error"]).toContain("No se pudo descargar");
  });
});

function network(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl: FetchLike = async (url, init = {}) => {
    calls.push({ url, init });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)]!;
    return new Response(JSON.stringify(next.body), { status: next.status });
  };
  return { calls, fetchImpl };
}

const OK = { status: 200, body: { choices: [{ message: { content: "Listo" } }] } };
const photo = { kind: "image" as const, mimeType: "image/jpeg", data: "AAAA" };
const voice = { kind: "audio" as const, mimeType: "audio/ogg", data: "T2dnUw==" };
const request = (attachments: ReadonlyArray<typeof photo | typeof voice>) => ({
  apiKey: "sk-test-0000000000", model: "m", system: "", messages: [{ role: "user" as const, content: "Hola", attachments }], json: false, maxOutputTokens: 100, timeoutMs: 1000
});

describe("proveedores con archivos", () => {
  it("OpenAI: la foto va como image_url; la nota de voz se transcribe antes y va como texto", async () => {
    const net = network([{ status: 200, body: { text: "quiero una canción para mi mamá" } }, OK]);
    const result = await createOpenAiClient(net.fetchImpl).chat(request([photo, voice]));

    expect(result.ok).toBe(true);
    expect(net.calls[0]!.url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect((net.calls[0]!.init.body as FormData).get("model")).toBe("gpt-4o-mini-transcribe");
    expect(JSON.parse(String(net.calls[1]!.init.body)).messages).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "Hola\n\nNota de voz del cliente: «quiero una canción para mi mamá»" },
          { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } }
        ]
      }
    ]);
  });

  it("OpenAI: si la cuenta no tiene el modelo nuevo de transcripción, usa whisper-1", async () => {
    const net = network([{ status: 404, body: { error: { code: "model_not_found", message: "no" } } }, { status: 200, body: { text: "hola" } }, OK]);
    await createOpenAiClient(net.fetchImpl).chat(request([voice]));
    expect((net.calls[1]!.init.body as FormData).get("model")).toBe("whisper-1");
  });

  it("OpenRouter: la nota de voz va al modelo como input_audio", async () => {
    const net = network([OK]);
    await createOpenRouterClient(net.fetchImpl).chat(request([voice]));
    expect(JSON.parse(String(net.calls[0]!.init.body)).messages[0].content[1]).toEqual({ type: "input_audio", input_audio: { data: "T2dnUw==", format: "ogg" } });
  });

  it("Gemini: foto y audio van como inline_data junto al texto", async () => {
    const net = network([{ status: 200, body: { candidates: [{ content: { parts: [{ text: "Listo" }] } }] } }]);
    await new GeminiClient(net.fetchImpl).chat(request([photo, voice]));
    expect(JSON.parse(String(net.calls[0]!.init.body)).contents[0].parts).toEqual([
      { text: "Hola" },
      { inline_data: { mime_type: "image/jpeg", data: "AAAA" } },
      { inline_data: { mime_type: "audio/ogg", data: "T2dnUw==" } }
    ]);
  });
});
