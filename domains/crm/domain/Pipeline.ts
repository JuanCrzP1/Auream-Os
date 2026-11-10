import {
  CRM_STAGES_MAX,
  CRM_STAGES_MIN,
  STAGE_OUTCOMES,
  type SavePipelineRequest,
  type StageOutcome
} from "../../../contracts/CrmContracts";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Embudo: sus etapas en orden. Cada etapa es una etiqueta de Contactos (su
// nombre y color son los de la etiqueta) y dice qué significa estar ahí:
// aún no compra (`open`), ya compró (`won`) o no compró (`lost`).
// ---------------------------------------------------------------------------

export interface Stage {
  readonly id: string;
  readonly pipelineId: string;
  readonly labelId: string;
  readonly name: string;
  readonly color: string;
  readonly outcome: StageOutcome;
  readonly position: number;
}

export interface Pipeline {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly stages: ReadonlyArray<Stage>;
  readonly entryStageId: string | null;
  readonly saleStageId: string | null;
  readonly defaultProductId: string | null;
  readonly autoAssign: boolean;
}

export const PIPELINE_NAME_MAX = 60;
/** Lo mismo que una etiqueta (la etapa ES la etiqueta). */
export const STAGE_NAME_MAX = 40;

export interface StageInput {
  readonly id: string | null;
  readonly name: string;
  readonly color: string | null;
  readonly outcome: StageOutcome;
}

/** Lo que se guarda de un embudo, ya validado. */
export interface PipelineDraft {
  readonly name: string;
  readonly stages: ReadonlyArray<StageInput>;
  readonly entryStage: number | null;
  readonly saleStage: number | null;
  readonly defaultProductId: string | null;
  readonly autoAssign: boolean;
}

const HEX = /^#[0-9a-f]{6}$/i;
const clean = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");

function stageOf(value: unknown, index: number): StageInput {
  const raw = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const name = clean(raw.name);
  if (!name) throw new ValidationError(`La etapa ${index + 1} necesita un nombre.`);
  if (name.length > STAGE_NAME_MAX) throw new ValidationError(`«${name}» es muy largo: hasta ${STAGE_NAME_MAX} caracteres.`);
  const outcome = STAGE_OUTCOMES.includes(raw.outcome as StageOutcome) ? (raw.outcome as StageOutcome) : null;
  if (!outcome) throw new ValidationError(`Elige qué quiere decir la etapa «${name}».`);
  const color = raw.color === undefined || raw.color === null ? null : String(raw.color);
  if (color !== null && !HEX.test(color)) throw new ValidationError("El color debe tener la forma #rrggbb.");
  const id = typeof raw.id === "string" && raw.id ? raw.id : null;
  return { id, name, color: color?.toLowerCase() ?? null, outcome };
}

function positionOf(value: unknown, stages: ReadonlyArray<StageInput>, wanted: StageOutcome, label: string): number | null {
  if (value === undefined || value === null) return null;
  const index = Number(value);
  const stage = Number.isInteger(index) ? stages[index] : undefined;
  if (!stage) throw new ValidationError(`La etapa de ${label} no existe.`);
  if (stage.outcome !== wanted) {
    throw new ValidationError(wanted === "open" ? "Los contactos nuevos entran en una etapa de «Aún no compra»." : "Quien compra pasa a una etapa de «Ya compró».");
  }
  return index;
}

/** Valida un embudo completo (o `ValidationError` con el motivo en español). */
export function requirePipelineDraft(input: Partial<SavePipelineRequest>): PipelineDraft {
  const name = clean(input.name);
  if (!name) throw new ValidationError("El embudo necesita un nombre.");
  if (name.length > PIPELINE_NAME_MAX) throw new ValidationError(`El nombre del embudo admite hasta ${PIPELINE_NAME_MAX} caracteres.`);
  const list = Array.isArray(input.stages) ? input.stages : [];
  if (list.length < CRM_STAGES_MIN) throw new ValidationError(`Un embudo necesita al menos ${CRM_STAGES_MIN} etapas.`);
  if (list.length > CRM_STAGES_MAX) throw new ValidationError(`Un embudo admite hasta ${CRM_STAGES_MAX} etapas.`);
  const stages = list.map(stageOf);
  const names = new Set<string>();
  for (const stage of stages) {
    const key = stage.name.toLowerCase();
    if (names.has(key)) throw new ValidationError(`Hay dos etapas llamadas «${stage.name}».`);
    names.add(key);
  }
  if (!stages.some((stage) => stage.outcome === "open")) throw new ValidationError("Falta una etapa de «Aún no compra».");
  if (!stages.some((stage) => stage.outcome === "won")) throw new ValidationError("Falta una etapa de «Ya compró».");
  return {
    name,
    stages,
    entryStage: positionOf(input.entryStage, stages, "open", "entrada"),
    saleStage: positionOf(input.saleStage, stages, "won", "compra"),
    defaultProductId: typeof input.defaultProductId === "string" && input.defaultProductId ? input.defaultProductId : null,
    autoAssign: input.autoAssign === true
  };
}

/**
 * Las etapas del tablero en orden, sin las de «no compró» (esas no avanzan:
 * se cuentan aparte). Es la cinta del embudo.
 */
export function funnelStages(pipeline: Pick<Pipeline, "stages">): ReadonlyArray<Stage> {
  return [...pipeline.stages].sort((a, b) => a.position - b.position).filter((stage) => stage.outcome !== "lost");
}

/** El embudo que se ofrece al empezar: el de una venta por WhatsApp. */
export const STARTER_PIPELINE: SavePipelineRequest = {
  name: "Ventas",
  stages: [
    { name: "Nuevo", color: "#8b5cf6", outcome: "open" },
    { name: "Interesado", color: "#6c5ce7", outcome: "open" },
    { name: "Pidió precio", color: "#4f6bed", outcome: "open" },
    { name: "Pagó", color: "#0d9488", outcome: "won" },
    { name: "Entregado", color: "#0b7a70", outcome: "won" },
    { name: "Perdido", color: "#e11d48", outcome: "lost" }
  ],
  entryStage: 0,
  saleStage: 3,
  autoAssign: false
};
