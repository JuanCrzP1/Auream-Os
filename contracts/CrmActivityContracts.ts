import type { Money } from "./CrmContracts";

// ---------------------------------------------------------------------------
// CRM: seguimientos (tareas con fecha y responsable), el historial de cada
// cliente y lo que muestra su ficha. Los embudos y el tablero: `CrmContracts`.
// ---------------------------------------------------------------------------

export interface FollowUpSummary {
  readonly id: string;
  readonly contactId: string;
  readonly contactName: string | null;
  readonly title: string;
  readonly dueAt: string;
  readonly assigneeId: string | null;
  readonly assigneeName: string | null;
  readonly doneAt: string | null;
  readonly doneByName: string | null;
}

export const FOLLOW_UP_BUCKETS = ["overdue", "today", "upcoming", "done"] as const;
export type FollowUpBucket = (typeof FOLLOW_UP_BUCKETS)[number];

export interface FollowUpListResponse {
  readonly followUps: ReadonlyArray<FollowUpSummary>;
  /** Pendientes de la persona que pregunta (o de todos con `assignee=all`). */
  readonly counts: { readonly overdue: number; readonly today: number; readonly upcoming: number };
}

export interface SaveFollowUpRequest {
  readonly contactId: string;
  readonly title: string;
  readonly dueAt: string;
  /** Sin indicar: quien lo crea. */
  readonly assigneeId?: string | null;
}

export interface UpdateFollowUpRequest {
  readonly title?: string;
  readonly dueAt?: string;
  readonly assigneeId?: string | null;
  readonly done?: boolean;
}

/** Quién movió: un flujo, una persona, una venta aprobada o el CRM solo (entrada y reparto). */
export const CRM_SOURCES = ["flow", "user", "sale", "auto"] as const;
export type CrmSource = (typeof CRM_SOURCES)[number];

export interface CrmEventSummary {
  readonly id: string;
  /** `stage` cambió de etapa · `left` salió del embudo · `owner` responsable · `value` valor. */
  readonly kind: "stage" | "left" | "owner" | "value";
  readonly pipelineId: string;
  readonly fromStageId: string | null;
  readonly toStageId: string | null;
  readonly source: CrmSource;
  readonly actorName: string | null;
  readonly flowName: string | null;
  /** Lo que cambió: el responsable nuevo, el valor o el motivo. */
  readonly detail: string | null;
  readonly createdAt: string;
}

export interface ContactDeal {
  readonly pipelineId: string;
  readonly stageId: string | null;
  readonly value: Money | null;
  readonly productId: string | null;
  readonly productName: string | null;
  readonly ownerId: string | null;
  readonly ownerName: string | null;
  readonly enteredAt: string | null;
}

/** Una compra del cliente en un embudo (la actual o una anterior), para su historial. */
export interface ContactPurchase {
  readonly dealId: string;
  readonly pipelineId: string;
  /** 1.ª, 2.ª, 3.ª… */
  readonly number: number;
  /** La compra actual (la que se mueve). */
  readonly current: boolean;
  /** Dónde está o dónde terminó (`null`: salió del embudo). */
  readonly stageId: string | null;
  readonly value: Money | null;
  readonly productName: string | null;
  /** Cuándo entró al embudo esta compra. */
  readonly openedAt: string;
  /** Cuándo compró (`null`: aún no, o no compró). */
  readonly wonAt: string | null;
  /** El anuncio por el que llegó (su nombre en Meta, si se conoce). */
  readonly adName: string | null;
  readonly adSourceId: string | null;
}

export interface ContactCrmResponse {
  readonly deals: ReadonlyArray<ContactDeal>;
  /** Todas sus compras, de cada embudo, la más nueva primero. */
  readonly purchases: ReadonlyArray<ContactPurchase>;
  readonly followUps: ReadonlyArray<FollowUpSummary>;
  readonly events: ReadonlyArray<CrmEventSummary>;
}
