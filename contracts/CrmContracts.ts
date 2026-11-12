// ---------------------------------------------------------------------------
// CRM (`/crm`): embudos con sus etapas, el cliente en cada etapa con su valor
// y su responsable, los seguimientos y el historial. Cada etapa ES una
// etiqueta de Contactos: el bloque Etiquetas de los flujos mueve clientes de
// etapa, y un cliente está en una sola etapa por embudo.
// ---------------------------------------------------------------------------

/** Qué quiere decir estar en la etapa: aún no compra, ya compró o no compró. */
export const STAGE_OUTCOMES = ["open", "won", "lost"] as const;
export type StageOutcome = (typeof STAGE_OUTCOMES)[number];

/** Embudos por cuenta (como FunnelChat: hasta 10 tableros). */
export const CRM_PIPELINES_MAX = 10;
export const CRM_STAGES_MIN = 2;
export const CRM_STAGES_MAX = 12;
/** Tarjetas por etapa en el tablero; el resto se pide por páginas. */
export const CRM_CARDS_PER_STAGE = 25;

export interface StageSummary {
  readonly id: string;
  /** La etiqueta de Contactos que representa la etapa. */
  readonly labelId: string;
  readonly name: string;
  readonly color: string;
  readonly outcome: StageOutcome;
  readonly position: number;
}

/**
 * Quiénes entran solos a la etapa de entrada:
 *   all  todo el que escribe y aún no está en el embudo (nuevo o de antes)
 *   ads  solo los que llegaron por un anuncio (Click to WhatsApp)
 */
export type EntrySource = "all" | "ads";
export const ENTRY_SOURCES: ReadonlyArray<EntrySource> = ["all", "ads"];

export interface PipelineSummary {
  readonly id: string;
  readonly name: string;
  readonly stages: ReadonlyArray<StageSummary>;
  /** Quien escribe y aún no está en el embudo entra aquí (o `null`: nadie entra solo). */
  readonly entryStageId: string | null;
  /** Quiénes entran solos: todos los que escriben, o solo los que llegaron por un anuncio. */
  readonly entrySource: EntrySource;
  /** Al aprobarse una venta del cliente, pasa aquí (o `null`). */
  readonly saleStageId: string | null;
  /** Su precio en el país del cliente es el valor de quien entra sin valor. */
  readonly defaultProductId: string | null;
  /** Repartir a los que entran entre el equipo, por turnos. */
  readonly autoAssign: boolean;
}

/** Quien puede ser responsable de un cliente. */
export interface CrmMember {
  readonly userId: string;
  readonly name: string;
  readonly photoUrl: string | null;
}

export interface PipelineListResponse {
  readonly pipelines: ReadonlyArray<PipelineSummary>;
  readonly members: ReadonlyArray<CrmMember>;
  /** Mover clientes, poner valor y responsable, seguimientos (`crm.write`). */
  readonly canWrite: boolean;
  /** Crear y configurar embudos (`crm.manage`). */
  readonly canManage: boolean;
}

export interface StageDraft {
  /** Etapa existente; sin id, una nueva. */
  readonly id?: string;
  readonly name: string;
  readonly color?: string;
  readonly outcome: StageOutcome;
}

export interface SavePipelineRequest {
  readonly name: string;
  /** En orden. Guardar reemplaza la lista: una etapa que no viene se quita (su etiqueta queda). */
  readonly stages: ReadonlyArray<StageDraft>;
  /** Posición (en `stages`) de la etapa de entrada, o `null`. */
  readonly entryStage?: number | null;
  /** Posición de la etapa a la que pasa quien compra, o `null`. */
  readonly saleStage?: number | null;
  readonly defaultProductId?: string | null;
  readonly autoAssign?: boolean;
  readonly entrySource?: EntrySource;
}

/** Traer al embudo a los clientes que ya tienes: los que escribieron en los últimos `days` días (`null`: todos). */
export interface ImportClientsRequest {
  readonly days: number | null;
}

/** Cuántos entrarían (vista previa) o cuántos entraron. */
export interface ImportClientsResponse {
  readonly count: number;
  /** Solo al traerlos: los que faltan por pasar (más de los que caben en una vez). */
  readonly remaining?: number;
}

/** Cuántos se traen como máximo en una vez (el resto, volviendo a tocar). */
export const MAX_IMPORT_PER_RUN = 500;

export interface Money {
  readonly amount: number;
  readonly currency: string;
}

export interface DealCard {
  readonly contactId: string;
  /** La compra (`null`: el cliente tiene la etiqueta pero aún no su registro). */
  readonly dealId: string | null;
  /** 1.ª, 2.ª, 3.ª… compra del cliente en este embudo. */
  readonly number: number;
  /** La compra actual (se mueve). Las anteriores quedan donde terminaron: no se mueven. */
  readonly current: boolean;
  /** Lo que lleva comprado el cliente en este embudo (si es su 2.ª compra o más). */
  readonly boughtTotal: Money | null;
  readonly name: string | null;
  readonly phone: string | null;
  readonly country: string | null;
  readonly stageId: string;
  readonly value: Money | null;
  readonly productName: string | null;
  readonly ownerId: string | null;
  readonly ownerName: string | null;
  readonly nextFollowUp: { readonly id: string; readonly title: string; readonly dueAt: string } | null;
  readonly lastMessageAt: string | null;
  /** Desde cuándo está en esta etapa. */
  readonly enteredAt: string;
}

export interface StageColumn {
  readonly stageId: string;
  readonly count: number;
  /** Lo que suman, por moneda (nunca se mezclan). */
  readonly totals: ReadonlyArray<Money>;
  readonly cards: ReadonlyArray<DealCard>;
}

export interface PipelineMetrics {
  /** Lo que suman los que aún no compran. */
  readonly openTotals: ReadonlyArray<Money>;
  readonly openCount: number;
  /** Los que pasaron a una etapa de compra en los últimos 30 días. */
  readonly wonTotals: ReadonlyArray<Money>;
  readonly wonCount: number;
  /** De todos los del embudo, cuántos compraron (0 a 1), o `null` si está vacío. */
  readonly closeRate: number | null;
  /** Días promedio desde que entran hasta que compran (últimos 90 días). */
  readonly avgDaysToClose: number | null;
  readonly lostCount: number;
  /** Entre cada etapa (sin las de «no compró») y la siguiente: qué parte avanza (0 a 1). */
  readonly advance: ReadonlyArray<number | null>;
  /** De los que compraron en los últimos 90 días, cuántos han comprado más de una vez (0 a 1). */
  readonly repeatRate: number | null;
  /** Lo que compra cada cliente en promedio, en la moneda en que más se vende. */
  readonly valuePerBuyer: Money | null;
}

export interface BoardResponse {
  readonly pipelineId: string;
  readonly columns: ReadonlyArray<StageColumn>;
  readonly metrics: PipelineMetrics;
}

/** `me`: mis clientes · `none`: sin responsable · o el id de un miembro. */
export interface BoardFilters {
  readonly owner?: string;
  readonly search?: string;
}

export interface StageCardsResponse {
  readonly cards: ReadonlyArray<DealCard>;
  readonly nextOffset: number | null;
}

export interface MoveDealRequest {
  readonly stageId: string;
  /** Por qué no compró (al pasar a una etapa de «no compró»). */
  readonly reason?: string;
}

export interface UpdateDealRequest {
  /** El texto se lee con la regla de montos de siempre («49.900» = 49900). */
  readonly amount?: number | string | null;
  readonly currency?: string | null;
  readonly productId?: string | null;
  readonly ownerId?: string | null;
}
