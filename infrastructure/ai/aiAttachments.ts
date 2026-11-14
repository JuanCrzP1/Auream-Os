import type { AiGenerateResult, AiMessage } from "../../flow-engine/ports/AiGateway";
import type { FetchLike } from "./AiProviderClient";
import { failureFromStatus, requestJson } from "./aiHttp";

// ---------------------------------------------------------------------------
// La foto y la nota de voz del cliente, en el formato de cada proveedor:
//
//   OpenAI      foto → `image_url` (data URL) · audio → se transcribe antes
//               (`/audio/transcriptions`) y va como texto
//   OpenRouter  foto → `image_url` · audio → `input_audio` (el modelo lo oye)
//   Gemini      los dos → `inline_data` (ver GeminiClient)
// ---------------------------------------------------------------------------

export type CompatibleAudio = "transcribe" | "input_audio";

const TRANSCRIBE_MODELS = ["gpt-4o-mini-transcribe", "whisper-1"] as const;
const TRANSCRIBE_TIMEOUT_MS = 30_000;

/** `audio/ogg` → `ogg` (lo que pide `input_audio`). */
function audioFormat(mimeType: string): string {
  const subtype = mimeType.split("/")[1] ?? "";
  return { mpeg: "mp3", "x-wav": "wav", mp4: "m4a", "x-m4a": "m4a" }[subtype] ?? subtype;
}

function extension(mimeType: string): string {
  const format = audioFormat(mimeType);
  return format === "amr" ? "ogg" : format || "ogg";
}

/** Un mensaje en Chat Completions: texto solo, o partes (texto + fotos + audios). */
export function compatibleContent(message: AiMessage): unknown {
  const attachments = message.attachments ?? [];
  if (attachments.length === 0) return message.content;
  return [
    ...(message.content ? [{ type: "text", text: message.content }] : []),
    ...attachments.map((attachment) =>
      attachment.kind === "image"
        ? { type: "image_url", image_url: { url: `data:${attachment.mimeType};base64,${attachment.data}` } }
        : { type: "input_audio", input_audio: { data: attachment.data, format: audioFormat(attachment.mimeType) } }
    )
  ];
}

/**
 * OpenAI no oye audios en el chat: cada nota de voz se transcribe y su texto
 * reemplaza al audio en el mensaje. Si falla, se devuelve el motivo.
 */
export async function transcribeAudios(
  fetchImpl: FetchLike,
  baseUrl: string,
  apiKey: string,
  messages: ReadonlyArray<AiMessage>
): Promise<{ readonly ok: true; readonly messages: AiMessage[] } | Extract<AiGenerateResult, { ok: false }>> {
  const out: AiMessage[] = [];
  for (const message of messages) {
    const audios = (message.attachments ?? []).filter((attachment) => attachment.kind === "audio");
    if (audios.length === 0) {
      out.push(message);
      continue;
    }
    const heard: string[] = [];
    for (const audio of audios) {
      const result = await transcribe(fetchImpl, baseUrl, apiKey, audio.mimeType, audio.data);
      if (!result.ok) return result;
      heard.push(result.text);
    }
    const images = (message.attachments ?? []).filter((attachment) => attachment.kind !== "audio");
    const content = [message.content, ...heard.map((text) => `Nota de voz del cliente: «${text}»`)].filter(Boolean).join("\n\n");
    out.push({ role: message.role, content, ...(images.length > 0 ? { attachments: images } : {}) });
  }
  return { ok: true, messages: out };
}

async function transcribe(fetchImpl: FetchLike, baseUrl: string, apiKey: string, mimeType: string, data: string): Promise<{ ok: true; text: string } | Extract<AiGenerateResult, { ok: false }>> {
  let last: Extract<AiGenerateResult, { ok: false }> = { ok: false, reason: "provider_error", message: "No se pudo transcribir la nota de voz." };
  for (const model of TRANSCRIBE_MODELS) {
    const form = new FormData();
    form.append("model", model);
    form.append("file", new Blob([Buffer.from(data, "base64")], { type: mimeType }), `nota.${extension(mimeType)}`);
    const result = await requestJson(fetchImpl, `${baseUrl}/audio/transcriptions`, { method: "POST", headers: { authorization: `Bearer ${apiKey}` }, body: form }, TRANSCRIBE_TIMEOUT_MS);
    if (!result.ok) return result;
    if (result.status >= 200 && result.status < 300) {
      const text = (result.body as { text?: unknown } | null)?.text;
      return { ok: true, text: typeof text === "string" ? text.trim() : "" };
    }
    const failure = failureFromStatus(result.status, result.body);
    last = { ok: false, reason: failure.reason, message: `No se pudo transcribir la nota de voz: ${failure.message}` };
    // Si la cuenta no tiene el modelo nuevo, se prueba el clásico.
    if (failure.reason !== "model_not_found") return last;
  }
  return last;
}
