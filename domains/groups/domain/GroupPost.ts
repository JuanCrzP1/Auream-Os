import { GROUP_LIMITS, type CreateGroupPostRequest, type GroupPostContent, type GroupPostKind } from "../../../contracts/GroupContracts";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Un mensaje a muchos grupos (ahora o programado) y la bienvenida agrupada.
// ---------------------------------------------------------------------------

const KINDS: ReadonlyArray<GroupPostKind> = ["text", "image", "video", "audio", "poll"];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const ids = (value: unknown) => (Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 64))] : []);

export function requirePostContent(value: unknown): GroupPostContent {
  const input = isRecord(value) ? value : {};
  const kind = KINDS.includes(input["kind"] as GroupPostKind) ? (input["kind"] as GroupPostKind) : "text";
  const text = typeof input["text"] === "string" ? input["text"].trim() : "";
  if (text.length > GROUP_LIMITS.maxPostText) throw new ValidationError(`El mensaje admite hasta ${GROUP_LIMITS.maxPostText} caracteres.`);
  const mediaUrl = typeof input["mediaUrl"] === "string" && /^https?:\/\//.test(input["mediaUrl"]) ? input["mediaUrl"] : null;
  const fileName = typeof input["fileName"] === "string" ? input["fileName"].slice(0, 120) : null;
  const choices = Array.isArray(input["choices"]) ? input["choices"].filter((c): c is string => typeof c === "string").map((c) => c.trim()).filter(Boolean) : [];
  if (kind === "text" && !text) throw new ValidationError("Escribe el mensaje.");
  if ((kind === "image" || kind === "video" || kind === "audio") && !mediaUrl) throw new ValidationError("Sube el archivo que quieres enviar.");
  if (kind === "poll") {
    if (!text) throw new ValidationError("Escribe la pregunta de la encuesta.");
    if (choices.length < 2 || choices.length > GROUP_LIMITS.maxPollChoices) throw new ValidationError(`La encuesta lleva de 2 a ${GROUP_LIMITS.maxPollChoices} opciones.`);
  }
  return { kind, text, mediaUrl: kind === "text" || kind === "poll" ? null : mediaUrl, fileName: kind === "text" || kind === "poll" ? null : fileName, choices: kind === "poll" ? [...new Set(choices)].map((c) => c.slice(0, 100)) : [] };
}

export function requirePost(value: unknown, now: Date): CreateGroupPostRequest {
  const input = isRecord(value) ? value : {};
  const campaignIds = ids(input["campaignIds"]);
  const groupIds = ids(input["groupIds"]);
  if (campaignIds.length === 0 && groupIds.length === 0) throw new ValidationError("Elige a qué grupos se envía.");
  let scheduledAt: string | null = null;
  if (typeof input["scheduledAt"] === "string" && input["scheduledAt"]) {
    const at = new Date(input["scheduledAt"]);
    if (Number.isNaN(at.getTime())) throw new ValidationError("La fecha programada no es válida.");
    if (at.getTime() < now.getTime() - 60_000) throw new ValidationError("La fecha programada ya pasó.");
    scheduledAt = at.toISOString();
  }
  return { campaignIds, groupIds, content: requirePostContent(input["content"]), mentionAll: input["mentionAll"] === true, scheduledAt };
}

/** «¡Bienvenidos @Laura, @Andrés y 12 más! 🎉»: con `{nombres}`, o al final si no está. */
export function welcomeText(template: string, people: ReadonlyArray<{ readonly phone: string }>, shown = 10): string {
  const listed = people.slice(0, shown).map((person) => `@${person.phone}`);
  const rest = people.length - listed.length;
  const names = listed.length === 0 ? "" : rest > 0 ? `${listed.join(", ")} y ${rest} más` : listed.length === 1 ? listed[0]! : `${listed.slice(0, -1).join(", ")} y ${listed.at(-1)}`;
  return template.includes("{nombres}") ? template.replace(/\{nombres\}/g, names) : `${template} ${names}`.trim();
}
