import {
  DEFAULT_BROADCAST_SETTINGS,
  EMPTY_AUDIENCE,
  type AbTestSettings,
  type AudienceFilter,
  type BroadcastMedia,
  type BroadcastSettings,
  type CreateBroadcastRequest
} from "@contracts/BroadcastContracts";

// Lo que se va armando en «Nueva difusión» y cómo se vuelve la petición.

export interface MessageDraft {
  readonly text: string;
  readonly media: BroadcastMedia | null;
}

export interface BroadcastDraft {
  readonly name: string;
  readonly kind: "flow" | "message";
  /** Versiones: 1 a 3 flujos o 1 a 3 mensajes. */
  readonly flowIds: ReadonlyArray<string>;
  readonly messages: ReadonlyArray<MessageDraft>;
  readonly audience: AudienceFilter;
  readonly connectionIds: ReadonlyArray<string>;
  /** `datetime-local` o `null` (ahora). */
  readonly scheduledAt: string | null;
  readonly settings: BroadcastSettings;
  readonly abTest: AbTestSettings | null;
  readonly followUp: { readonly afterHours: number; readonly text: string } | null;
}

export const EMPTY_DRAFT: BroadcastDraft = {
  name: "",
  kind: "flow",
  flowIds: [""],
  messages: [{ text: "Hola {first_name} 👋 ", media: null }],
  audience: { ...EMPTY_AUDIENCE, lastInboundDays: 60 },
  connectionIds: [],
  scheduledAt: null,
  settings: DEFAULT_BROADCAST_SETTINGS,
  abTest: null,
  followUp: { afterHours: 48, text: "Hola {first_name}, ¿pudiste verlo? Si tienes alguna duda, aquí estoy." }
};

export const STEPS = ["Qué enviar", "A quién", "Número y cuándo", "Revisar"] as const;

export function variantCount(draft: BroadcastDraft): number {
  return draft.kind === "flow" ? draft.flowIds.length : draft.messages.length;
}

/** Lo que falta para pasar del paso; `null` si está completo. */
export function stepProblem(draft: BroadcastDraft, step: number, reach: number | null): string | null {
  if (step === 0) {
    if (draft.kind === "flow" && draft.flowIds.some((id) => !id)) return "Elige el flujo de cada versión.";
    if (draft.kind === "message" && draft.messages.some((message) => !message.text.trim() && !message.media)) return "Escribe el mensaje o agrega una foto o un video.";
  }
  if (step >= 1 && draft.connectionIds.length > 0 && reach === 0) return "Con estos filtros no le llega a nadie.";
  if (step === 2 && draft.connectionIds.length === 0) return "Elige por cuál número sale.";
  if (step === 2 && draft.scheduledAt && new Date(draft.scheduledAt).getTime() < Date.now()) return "La hora programada ya pasó.";
  if (step === 3 && !draft.name.trim()) return "Ponle un nombre a la difusión.";
  if (step === 3 && draft.followUp && !draft.followUp.text.trim()) return "Escribe el mensaje del segundo envío.";
  return null;
}

export function toRequest(draft: BroadcastDraft): CreateBroadcastRequest {
  const variants =
    draft.kind === "flow"
      ? draft.flowIds.map((automationId) => ({ kind: "flow" as const, automationId }))
      : draft.messages.map((message) => ({ kind: "message" as const, text: message.text.trim(), media: message.media }));
  return {
    name: draft.name.trim(),
    variants,
    audience: draft.audience,
    connectionIds: draft.connectionIds,
    scheduledAt: draft.scheduledAt ? new Date(draft.scheduledAt).toISOString() : null,
    settings: draft.settings,
    abTest: variants.length > 1 ? draft.abTest : null,
    followUp: draft.followUp ? { afterHours: draft.followUp.afterHours, content: { kind: "message", text: draft.followUp.text.trim(), media: null } } : null
  };
}
