import type { FieldFilter } from "./ContactFieldFilters";
// ---------------------------------------------------------------------------
// Difusiones: un flujo o un mensaje a muchos clientes que ya escribieron, por
// los números de la cuenta, a un ritmo que cuida cada número. Contrato único
// entre la API y la web.
// ---------------------------------------------------------------------------

export const BROADCAST_LIMITS = {
  maxRecipients: 5000,
  maxVariants: 3,
  maxTextLength: 1000,
  maxNameLength: 80,
  minDailyCap: 20,
  maxDailyCap: 1000,
  defaultDailyCap: 300,
  /** Una venta cuenta para la última difusión que recibió el cliente si compra dentro de estos días. */
  attributionDays: 3,
  /** Con este porcentaje de fallos (después de 20 intentos) la difusión se pausa sola. */
  maxFailureRate: 0.05,
  minAttemptsForFailureCheck: 20
} as const;

/** Pausa al azar entre un mensaje y el siguiente, en segundos. */
export type BroadcastPace = "careful" | "normal";
export const PACE_SECONDS: Readonly<Record<BroadcastPace, readonly [number, number]>> = { careful: [20, 45], normal: [8, 25] };

/** Calentamiento: tope por día los primeros días que un número envía difusiones (después, el de la difusión). */
export const WARMUP_DAILY_CAPS: ReadonlyArray<number> = [20, 40, 60, 100, 150, 200, 250];

export interface BroadcastMedia {
  readonly type: "image" | "video";
  readonly url: string;
  readonly fileName?: string;
}

export type BroadcastContent =
  | { readonly kind: "flow"; readonly automationId: string }
  | { readonly kind: "message"; readonly text: string; readonly media: BroadcastMedia | null };

/** A quién: siempre gente que ya escribió por alguno de los números elegidos. */
export interface AudienceFilter {
  /** Tiene alguna de estas etiquetas (las etapas del CRM también son etiquetas). Vacío: todas. */
  readonly labelIds: ReadonlyArray<string>;
  readonly excludeLabelIds: ReadonlyArray<string>;
  /** ISO 3166-1 (por el prefijo del teléfono). Vacío: todos. */
  readonly countries: ReadonlyArray<string>;
  /** Escribió en los últimos N días. `null`: cuando sea. */
  readonly lastInboundDays: number | null;
  /** Sin compras aprobadas en los últimos N días. `null`: no excluye. */
  readonly excludeBoughtDays: number | null;
  /** Por sus Campos del cliente (ciudad, ya compró, presupuesto…): se cumplen todos. Ausente: sin filtro. */
  readonly fields?: ReadonlyArray<FieldFilter>;
}

export const EMPTY_AUDIENCE: AudienceFilter = { labelIds: [], excludeLabelIds: [], countries: [], lastInboundDays: null, excludeBoughtDays: null };

export interface BroadcastSettings {
  readonly pace: BroadcastPace;
  /** Máximo por número y por día (todas las difusiones juntas). */
  readonly dailyCap: number;
  /** Horas del negocio en que se envía: de `fromHour` a `toHour` (0–24). */
  readonly fromHour: number;
  readonly toHour: number;
  /** Agrega «Para no recibir más, responde SALIR» al final de los mensajes. */
  readonly optOutFooter: boolean;
}

export const DEFAULT_BROADCAST_SETTINGS: BroadcastSettings = { pace: "normal", dailyCap: BROADCAST_LIMITS.defaultDailyCap, fromHour: 8, toHour: 20, optOutFooter: true };

/** Prueba A/B: una parte de la lista recibe cada versión; al resto le llega la que más vendió. */
export interface AbTestSettings {
  readonly sharePercent: number;
  readonly decideAfterHours: number;
}

/** Segundo envío a quienes no respondieron, tantas horas después de terminar. */
export interface FollowUpSettings {
  readonly afterHours: number;
  readonly content: BroadcastContent;
}

export interface CreateBroadcastRequest {
  readonly name: string;
  /** 1 a 3 versiones. Sin prueba A/B, cada persona recibe una al azar (no todos el mismo texto). */
  readonly variants: ReadonlyArray<BroadcastContent>;
  readonly audience: AudienceFilter;
  readonly connectionIds: ReadonlyArray<string>;
  /** ISO. `null`: ahora. */
  readonly scheduledAt: string | null;
  readonly settings: BroadcastSettings;
  readonly abTest: AbTestSettings | null;
  readonly followUp: FollowUpSettings | null;
}

