import type { ContactFieldValue } from "../../../../contracts/ContactContracts";
import type { Session, SessionStatus } from "../../../../contracts/RuntimeContracts";
import { DEFAULT_SIMULATION_PERSONA, type SimulationEvent, type SimulationOptions, type SimulationPersona, type SimulationState, type SimulationWait } from "../../../../contracts/SimulationContracts";
import { ValidationError } from "../../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Lo que manda el navegador en cada turno de prueba, validado. El estado lo
// guarda el navegador, así que se lee con desconfianza: forma correcta,
// tamaños acotados y la sesión siempre de ESTA cuenta y de ESTE flujo.
// ---------------------------------------------------------------------------

const MAX_TEXT = 4_000;
const MAX_TAGS = 50;
const MAX_FIELDS = 100;
const SESSION_STATUSES: ReadonlyArray<SessionStatus> = ["active", "waiting_input", "paused", "delayed", "completed", "failed"];

const record = (value: unknown): Record<string, unknown> | null => (typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null);
const text = (value: unknown, max = 200): string => (typeof value === "string" ? value.slice(0, max) : "");

export function readPersona(raw: unknown): SimulationPersona {
  const value = record(raw);
  if (!value) return DEFAULT_SIMULATION_PERSONA;
  const phone = text(value["phone"]).replace(/\D/g, "");
  const fields: Record<string, ContactFieldValue> = {};
  for (const [key, field] of Object.entries(record(value["fields"]) ?? {}).slice(0, MAX_FIELDS)) {
    if (typeof field === "string" || typeof field === "number" || typeof field === "boolean") fields[key.slice(0, 64)] = typeof field === "string" ? field.slice(0, 500) : field;
  }
  return {
    name: text(value["name"], 80).trim() || DEFAULT_SIMULATION_PERSONA.name,
    phone: phone.length >= 7 && phone.length <= 15 ? phone : DEFAULT_SIMULATION_PERSONA.phone,
    email: text(value["email"], 120).trim(),
    tags: Array.isArray(value["tags"]) ? [...new Set(value["tags"].filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "").map((tag) => tag.trim().slice(0, 40)))].slice(0, MAX_TAGS) : [],
    fields
  };
}

function readSession(raw: unknown, tenantId: string, flowId: string): Session | null {
  const value = record(raw);
  if (!value) return null;
  const strings = ["id", "flowVersionId", "channel", "conversationKey", "userKey", "currentNodeId", "createdAt", "updatedAt"] as const;
  if (strings.some((key) => typeof value[key] !== "string")) return null;
  if (!SESSION_STATUSES.includes(value["status"] as SessionStatus) || !Number.isInteger(value["revision"])) return null;
  // La sesión siempre es de esta cuenta y de este flujo, diga lo que diga el navegador.
  if (value["flowId"] !== flowId) return null;
  return { ...(value as unknown as Session), tenantId, context: record(value["context"]) ?? {} };
}

function readWait(raw: unknown): SimulationWait | null {
  const value = record(raw);
  if (!value || (value["reason"] !== "resume" && value["reason"] !== "timeout") || typeof value["nodeId"] !== "string" || !Number.isInteger(value["revision"])) return null;
  return { reason: value["reason"], nodeId: value["nodeId"], revision: value["revision"] as number, until: text(value["until"], 40) };
}

function readCounters(raw: unknown): Record<string, number> {
  const counters: Record<string, number> = {};
  for (const [key, count] of Object.entries(record(raw) ?? {}).slice(0, 100)) {
    if (Number.isInteger(count) && (count as number) >= 0) counters[key.slice(0, 200)] = count as number;
  }
  return counters;
}

export function readState(raw: unknown, tenantId: string, flowId: string): SimulationState {
  const value = record(raw);
  return {
    session: readSession(value?.["session"], tenantId, flowId),
    persona: readPersona(value?.["persona"]),
    wait: readWait(value?.["wait"]),
    counters: readCounters(value?.["counters"])
  };
}

export function readEvent(raw: unknown): SimulationEvent {
  const value = record(raw);
  switch (value?.["type"]) {
    case "start":
      return { type: "start" };
    case "skip-wait":
      return { type: "skip-wait" };
    case "message": {
      const message = text(value["text"], MAX_TEXT);
      if (!message.trim()) throw new ValidationError("Escribe un mensaje para probar.");
      return { type: "message", text: message };
    }
    case "choice":
      if (typeof value["optionId"] !== "string" || !value["optionId"]) throw new ValidationError("Elige una opción del menú.");
      return { type: "choice", optionId: value["optionId"].slice(0, 120), title: text(value["title"], 120) };
    default:
      throw new ValidationError("Acción de prueba desconocida.");
  }
}

export function readOptions(raw: unknown): SimulationOptions {
  const value = record(raw);
  return { realAi: value?.["realAi"] === true, realIntegrations: value?.["realIntegrations"] === true };
}
