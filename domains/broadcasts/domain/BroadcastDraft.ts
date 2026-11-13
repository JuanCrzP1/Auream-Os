import {
  BROADCAST_LIMITS,
  PACE_SECONDS,
  type AbTestSettings,
  type AudienceFilter,
  type BroadcastContent,
  type BroadcastSettings,
  type CreateBroadcastRequest,
  type FollowUpSettings
} from "../../../contracts/BroadcastContracts";
import { COUNTRY_CODES_ISO } from "../../../contracts/Countries";
import { readFieldFilters } from "../../../contracts/ContactFieldFilters";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Lo que llega para crear una difusión, revisado y normalizado. Nada sale si
// algo no tiene sentido: el mensaje vacío, un horario al revés, más versiones
// de las permitidas, una prueba A/B con una sola versión.
// ---------------------------------------------------------------------------

export type BroadcastDraft = CreateBroadcastRequest;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const ids = (value: unknown, field: string): string[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.length > 0 && item.length <= 64)) throw new ValidationError(`${field} debe ser una lista.`);
  return [...new Set(value as string[])];
};
const whole = (value: unknown, min: number, max: number, field: string): number => {
  const number = typeof value === "number" ? value : Number.NaN;
  if (!Number.isInteger(number) || number < min || number > max) throw new ValidationError(`${field} debe estar entre ${min} y ${max}.`);
  return number;
};
const optionalDays = (value: unknown, field: string): number | null => (value === null || value === undefined ? null : whole(value, 1, 365, field));

export function requireContent(value: unknown, where = "El mensaje"): BroadcastContent {
  if (!isRecord(value)) throw new ValidationError(`${where} no es válido.`);
  if (value["kind"] === "flow") {
    const automationId = value["automationId"];
    if (typeof automationId !== "string" || !automationId) throw new ValidationError("Elige el flujo que quieres enviar.");
    return { kind: "flow", automationId };
  }
  if (value["kind"] !== "message") throw new ValidationError(`${where}: elige un flujo o un mensaje.`);
  const text = typeof value["text"] === "string" ? value["text"].trim() : "";
  const media = requireMedia(value["media"]);
  if (!text && !media) throw new ValidationError(`${where} está vacío: escribe un texto o agrega una foto o un video.`);
  if (text.length > BROADCAST_LIMITS.maxTextLength) throw new ValidationError(`${where} admite hasta ${BROADCAST_LIMITS.maxTextLength} caracteres.`);
  return { kind: "message", text, media };
}

function requireMedia(value: unknown): Extract<BroadcastContent, { kind: "message" }>["media"] {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || (value["type"] !== "image" && value["type"] !== "video")) throw new ValidationError("El archivo debe ser una foto o un video.");
  const url = value["url"];
  if (typeof url !== "string" || !/^https?:\/\//.test(url) || url.length > 2000) throw new ValidationError("El archivo no tiene una dirección válida.");
  const fileName = typeof value["fileName"] === "string" ? value["fileName"].slice(0, 120) : undefined;
  return { type: value["type"], url, ...(fileName ? { fileName } : {}) };
}

export function requireAudience(value: unknown): AudienceFilter {
  const input = isRecord(value) ? value : {};
  const countries = ids(input["countries"], "Países").map((code) => code.toUpperCase());
  if (countries.some((code) => !COUNTRY_CODES_ISO.includes(code))) throw new ValidationError("Hay un país que no reconocemos.");
  const fields = readFieldFilters(input["fields"]);
  if (!fields.ok) throw new ValidationError(fields.message);
  return {
    labelIds: ids(input["labelIds"], "Etiquetas"),
    excludeLabelIds: ids(input["excludeLabelIds"], "Etiquetas excluidas"),
    countries,
    lastInboundDays: optionalDays(input["lastInboundDays"], "Escribió en los últimos días"),
    excludeBoughtDays: optionalDays(input["excludeBoughtDays"], "Sin compras en los últimos días"),
    ...(fields.filters.length > 0 ? { fields: fields.filters } : {})
  };
}

function requireSettings(value: unknown): BroadcastSettings {
  const input = isRecord(value) ? value : {};
  const pace = input["pace"] === "careful" ? "careful" : "normal";
  const fromHour = whole(input["fromHour"] ?? 8, 0, 23, "La hora de inicio");
  const toHour = whole(input["toHour"] ?? 20, 1, 24, "La hora de fin");
  if (toHour - fromHour < 2) throw new ValidationError("Deja al menos 2 horas para enviar cada día.");
  return {
    pace: pace in PACE_SECONDS ? pace : "normal",
    dailyCap: whole(input["dailyCap"] ?? BROADCAST_LIMITS.defaultDailyCap, BROADCAST_LIMITS.minDailyCap, BROADCAST_LIMITS.maxDailyCap, "El máximo por día"),
    fromHour,
    toHour,
    optOutFooter: input["optOutFooter"] !== false
  };
}

function requireAbTest(value: unknown, variants: number): AbTestSettings | null {
  if (value === null || value === undefined) return null;
  if (variants < 2) throw new ValidationError("La prueba A/B necesita al menos 2 versiones.");
  const input = isRecord(value) ? value : {};
  return { sharePercent: whole(input["sharePercent"], 10, 50, "La parte de la prueba"), decideAfterHours: whole(input["decideAfterHours"], 2, 72, "Las horas de la prueba") };
}

function requireFollowUp(value: unknown): FollowUpSettings | null {
  if (value === null || value === undefined) return null;
  const input = isRecord(value) ? value : {};
  return { afterHours: whole(input["afterHours"], 12, 168, "Las horas del segundo envío"), content: requireContent(input["content"], "El segundo envío") };
}

/** La difusión lista para guardar. `now` decide si la hora programada ya pasó. */
export function requireBroadcastDraft(value: unknown, now: Date): BroadcastDraft {
  if (!isRecord(value)) throw new ValidationError("La difusión no es válida.");
  const name = typeof value["name"] === "string" ? value["name"].trim().slice(0, BROADCAST_LIMITS.maxNameLength) : "";
  if (!name) throw new ValidationError("Ponle un nombre a la difusión.");
  if (!Array.isArray(value["variants"]) || value["variants"].length === 0) throw new ValidationError("Elige qué enviar.");
  if (value["variants"].length > BROADCAST_LIMITS.maxVariants) throw new ValidationError(`Hasta ${BROADCAST_LIMITS.maxVariants} versiones.`);
  const variants = value["variants"].map((variant, index) => requireContent(variant, `La versión ${index + 1}`));
  if (variants.some((variant) => variant.kind !== variants[0]!.kind)) throw new ValidationError("Las versiones deben ser todas flujos o todas mensajes.");
  const connectionIds = ids(value["connectionIds"], "Números");
  if (connectionIds.length === 0) throw new ValidationError("Elige por qué número sale.");
  const scheduledAt = parseSchedule(value["scheduledAt"], now);
  return {
    name,
    variants,
    audience: requireAudience(value["audience"]),
    connectionIds,
    scheduledAt,
    settings: requireSettings(value["settings"]),
    abTest: requireAbTest(value["abTest"], variants.length),
    followUp: requireFollowUp(value["followUp"])
  };
}

function parseSchedule(value: unknown, now: Date): string | null {
  if (value === null || value === undefined || value === "") return null;
  const at = typeof value === "string" ? new Date(value) : new Date(Number.NaN);
  if (Number.isNaN(at.getTime())) throw new ValidationError("La fecha programada no es válida.");
  if (at.getTime() < now.getTime() - 60_000) throw new ValidationError("La fecha programada ya pasó.");
  if (at.getTime() > now.getTime() + 90 * 86_400_000) throw new ValidationError("Programa la difusión dentro de los próximos 90 días.");
  return at.toISOString();
}
