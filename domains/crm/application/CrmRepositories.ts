import type { BoardFilters, DealCard, EntrySource, Money, StageOutcome } from "../../../contracts/CrmContracts";
import type { CrmSource, FollowUpBucket } from "../../../contracts/CrmActivityContracts";
import type { Deal } from "../domain/Deal";
import type { FollowUp } from "../domain/FollowUp";
import type { Pipeline, Stage } from "../domain/Pipeline";

// ---------------------------------------------------------------------------
// Puertos de persistencia del CRM. Todo, siempre, por cuenta. Implementación:
// `infrastructure/persistence/sql/SqlCrm*.ts`.
// ---------------------------------------------------------------------------

/** Una etapa a guardar: ya con su etiqueta (creada o reutilizada). */
export interface StageRecord {
  readonly id: string;
  readonly labelId: string;
  readonly outcome: StageOutcome;
}

export interface PipelineRecord {
  readonly id: string;
  readonly name: string;
  readonly stages: ReadonlyArray<StageRecord>;
  readonly entryStageId: string | null;
  readonly saleStageId: string | null;
  readonly defaultProductId: string | null;
  readonly autoAssign: boolean;
  readonly entrySource: EntrySource;
}

export interface PipelineRepository {
  list(tenantId: string): Promise<ReadonlyArray<Pipeline>>;
  find(tenantId: string, pipelineId: string): Promise<Pipeline | null>;
  /** Crea o reemplaza el embudo y sus etapas en una transacción (las que no vienen se quitan). */
  save(tenantId: string, pipeline: PipelineRecord): Promise<void>;
  remove(tenantId: string, pipelineId: string): Promise<boolean>;
  /** Las etapas (de cualquier embudo de la cuenta) que son estas etiquetas. */
  stagesForLabels(tenantId: string, labelIds: ReadonlyArray<string>): Promise<ReadonlyArray<Stage>>;
  /** Todas las etiquetas de etapa de cada embudo que tiene alguna de estas como etapa (una consulta). */
  stageLabelGroups(tenantId: string, labelIds: ReadonlyArray<string>): Promise<ReadonlyArray<ReadonlyArray<string>>>;
  /** ¿Esta etiqueta ya es etapa de otro embudo? Devuelve su nombre. */
  pipelineUsingLabel(tenantId: string, labelId: string, except: string | null): Promise<string | null>;
}

export interface DealEntry {
  readonly stageId: string;
  readonly won: boolean;
  /** Valor y producto si el cliente aún no tiene. */
  readonly value: Money | null;
  readonly productId: string | null;
  readonly productName: string | null;
  /** Responsable si el cliente aún no tiene. */
  readonly ownerId: string | null;
  /** Anuncio por el que llegó (al abrir la compra). */
  readonly adSourceId?: string | null;
}

export interface DealChanges {
  readonly value?: Money | null;
  readonly productId?: string | null;
  readonly productName?: string | null;
  readonly ownerId?: string | null;
}

export interface DealRepository {
  /** La compra actual del cliente en el embudo. */
  find(tenantId: string, pipelineId: string, contactId: string): Promise<Deal | null>;
  /** Todas sus compras (actuales y anteriores), de cada embudo, con el nombre del responsable y del anuncio. */
  forContact(tenantId: string, contactId: string): Promise<ReadonlyArray<Deal & { readonly ownerName: string | null; readonly adName: string | null }>>;
  /** La compra actual entró a una etapa: la anota (y la crea si es la primera). */
  enter(tenantId: string, pipelineId: string, contactId: string, entry: DealEntry): Promise<Deal>;
  /** Abre otra compra (la n.º siguiente): la actual queda como anterior, tal como estaba. */
  reopen(tenantId: string, pipelineId: string, contactId: string, entry: DealEntry & { readonly saleId?: string | null }): Promise<Deal>;
  /** La venta aprobada que cerró la compra actual. */
  attachSale(tenantId: string, pipelineId: string, contactId: string, saleId: string): Promise<void>;
  /** Salió del embudo (le quitaron la etiqueta). */
  leave(tenantId: string, pipelineId: string, contactId: string): Promise<void>;
  update(tenantId: string, pipelineId: string, contactId: string, changes: DealChanges): Promise<Deal>;
}

export interface CrmEventInput {
  readonly pipelineId: string;
  readonly contactId: string;
  readonly kind: "stage" | "left" | "owner" | "value";
  readonly fromStageId: string | null;
  readonly toStageId: string | null;
  readonly source: CrmSource;
  readonly actorId: string | null;
  readonly flowKey: string | null;
  readonly detail: string | null;
}

export interface CrmEventRecord extends CrmEventInput {
  readonly id: string;
  readonly actorName: string | null;
  readonly flowName: string | null;
  readonly createdAt: string;
}

export interface CrmEventLog {
  append(tenantId: string, event: CrmEventInput): Promise<void>;
  forContact(tenantId: string, contactId: string, limit: number): Promise<ReadonlyArray<CrmEventRecord>>;
}

export interface FollowUpView extends FollowUp {
  readonly contactName: string | null;
  readonly assigneeName: string | null;
  readonly doneByName: string | null;
}

export interface FollowUpQuery {
  readonly bucket?: FollowUpBucket;
  /** Solo los de esta persona (`null`: de todos). */
  readonly assigneeId: string | null;
  readonly contactId?: string;
  /** Límites del día de la empresa (Vencidos · Hoy · Próximos). */
  readonly now: Date;
  readonly endOfToday: Date;
  readonly limit: number;
}

export interface FollowUpRepository {
  find(tenantId: string, id: string): Promise<FollowUpView | null>;
  list(tenantId: string, query: FollowUpQuery): Promise<ReadonlyArray<FollowUpView>>;
  counts(tenantId: string, query: Omit<FollowUpQuery, "bucket" | "limit" | "contactId">): Promise<{ overdue: number; today: number; upcoming: number }>;
  insert(followUp: FollowUp): Promise<void>;
  update(followUp: FollowUp): Promise<void>;
  remove(tenantId: string, id: string): Promise<boolean>;
}

/** El tablero: quién está en cada etapa (por su etiqueta) con su valor y responsable. */
export interface BoardQuery extends Omit<BoardFilters, "owner"> {
  /** Un miembro, `none` (sin responsable) o nada (todos). */
  readonly ownerId?: string | "none";
}

export interface StageCount {
  readonly stageId: string;
  readonly count: number;
  readonly totals: ReadonlyArray<Money>;
}

export interface BoardReader {
  counts(tenantId: string, pipeline: Pipeline, query: BoardQuery): Promise<ReadonlyArray<StageCount>>;
  cards(tenantId: string, pipeline: Pipeline, stageIds: ReadonlyArray<string>, query: BoardQuery, offset: number, limit: number): Promise<ReadonlyArray<DealCard>>;
  /** Lo vendido desde `since` y los días promedio hasta comprar (de quienes compraron desde `closedSince`). */
  won(tenantId: string, pipelineId: string, since: Date, closedSince: Date): Promise<{ totals: ReadonlyArray<Money>; count: number; avgDays: number | null }>;
  /**
   * Recompra: de los que compraron desde `since`, cuántos han comprado más de
   * una vez (0 a 1), y lo que compra cada cliente en promedio (moneda principal).
   */
  loyalty(tenantId: string, pipelineId: string, since: Date): Promise<{ repeatRate: number | null; valuePerBuyer: Money | null }>;
}
