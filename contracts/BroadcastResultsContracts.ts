import type { AbTestSettings, AudienceFilter, BroadcastContent, BroadcastSettings, FollowUpSettings } from "./BroadcastContracts";

// ---------------------------------------------------------------------------
// Difusiones: estado, resultados (del envío a la venta), destinatarios,
// audiencias guardadas y la vista previa del alcance.
// ---------------------------------------------------------------------------

export type BroadcastStatus = "scheduled" | "sending" | "testing" | "paused" | "auto_paused" | "done" | "cancelled";

export interface MoneyAmount {
  readonly currency: string;
  readonly amount: number;
}

export interface BroadcastStats {
  readonly total: number;
  readonly pending: number;
  readonly sent: number;
  readonly failed: number;
  /** No se enviaron: pidieron no recibir más, o se canceló. */
  readonly skipped: number;
  readonly delivered: number;
  readonly read: number;
  readonly replied: number;
  readonly optedOut: number;
  readonly bought: number;
  /** Por moneda, de mayor a menor. */
  readonly revenue: ReadonlyArray<MoneyAmount>;
}

export interface BroadcastVariantView {
  readonly content: BroadcastContent;
  /** El nombre del flujo, si es uno. */
  readonly flowName: string | null;
}

export interface BroadcastSummary {
  readonly id: string;
  readonly name: string;
  readonly status: BroadcastStatus;
  /** Por qué se pausó sola (o se canceló). */
  readonly statusReason: string | null;
  readonly parentId: string | null;
  readonly parentName: string | null;
  readonly variants: ReadonlyArray<BroadcastVariantView>;
  readonly audience: AudienceFilter;
  readonly connections: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly settings: BroadcastSettings;
  readonly abTest: (AbTestSettings & { readonly winner: number | null; readonly decidesAt: string | null }) | null;
  readonly followUp: (FollowUpSettings & { readonly dueAt: string | null; readonly childId: string | null }) | null;
  readonly scheduledAt: string | null;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly createdAt: string;
  readonly stats: BroadcastStats;
}

export interface BroadcastListResponse {
  readonly broadcasts: ReadonlyArray<BroadcastSummary>;
  /** Lo de las difusiones que empezaron este mes. */
  readonly month: Pick<BroadcastStats, "sent" | "read" | "replied" | "bought" | "revenue"> & { readonly broadcasts: number; readonly autoPaused: number };
  readonly canManage: boolean;
}

export interface VariantResult {
  readonly variant: number;
  readonly sent: number;
  readonly replied: number;
  readonly bought: number;
  readonly revenue: ReadonlyArray<MoneyAmount>;
}

export interface NumberPace {
  readonly connectionId: string;
  readonly name: string;
  readonly sentToday: number;
  /** El tope de hoy (con el calentamiento). */
  readonly capToday: number;
  /** Día de calentamiento (1–7) o `null` si ya terminó. */
  readonly warmupDay: number | null;
  readonly connected: boolean;
}

export interface BroadcastDetailResponse {
  readonly broadcast: BroadcastSummary;
  readonly variants: ReadonlyArray<VariantResult>;
  readonly numbers: ReadonlyArray<NumberPace>;
  /** La próxima vez que sale un mensaje (ritmo, horario o tope). */
  readonly nextSendAt: string | null;
  readonly canManage: boolean;
}

export type RecipientState = "pending" | "sent" | "delivered" | "read" | "replied" | "bought" | "failed" | "opted_out" | "skipped";
export const RECIPIENT_FILTERS = ["all", "bought", "replied", "read", "unread", "failed"] as const;
export type RecipientFilter = (typeof RECIPIENT_FILTERS)[number];

export interface RecipientView {
  readonly id: string;
  readonly contactId: string | null;
  readonly name: string | null;
  readonly phone: string;
  readonly connectionName: string;
  readonly state: RecipientState;
  readonly variant: number | null;
  readonly sentAt: string | null;
  readonly error: string | null;
  readonly sale: MoneyAmount | null;
}

export interface RecipientsPage {
  readonly recipients: ReadonlyArray<RecipientView>;
  readonly counts: Readonly<Record<RecipientFilter, number>>;
  readonly nextOffset: number | null;
}

export interface AudiencePreviewRequest {
  readonly audience: AudienceFilter;
  readonly connectionIds: ReadonlyArray<string>;
}

export interface AudiencePreview {
  readonly count: number;
  readonly perConnection: ReadonlyArray<{ readonly connectionId: string; readonly count: number }>;
  /** Pidieron no recibir más (no se cuentan). */
  readonly optedOut: number;
  /** Quedan fuera por el máximo de una difusión. */
  readonly overLimit: number;
  /** Para la vista previa: nombres de ejemplo. */
  readonly sample: ReadonlyArray<{ readonly name: string | null; readonly phone: string }>;
  /** Cuántos días tarda, con el tope por número y el calentamiento. */
  readonly days: number;
  readonly numbers: ReadonlyArray<NumberPace>;
}

export interface SavedAudience {
  readonly id: string;
  readonly name: string;
  readonly audience: AudienceFilter;
  readonly createdAt: string;
}

export interface SaveAudienceRequest {
  readonly name: string;
  readonly audience: AudienceFilter;
}

export interface BroadcastTestRequest {
  readonly content: BroadcastContent;
  readonly connectionId: string;
  readonly phone: string;
}
