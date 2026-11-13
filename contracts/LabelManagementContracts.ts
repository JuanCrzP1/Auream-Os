import type { LabelSummary } from "./ContactContracts";

// ---------------------------------------------------------------------------
// Etiquetas (Configuración › Datos › Etiquetas): cuántos clientes tiene cada
// una, cuánto vendieron, quién la usa (la etapa de un embudo, los bloques de
// los flujos, las difusiones por enviar, los públicos guardados, los webhooks
// y las campañas de grupos), las repetidas y unir una en otra sin romper
// nada. Contrato API ↔ web.
// ---------------------------------------------------------------------------

/** Dónde trabaja una etiqueta. */
export type LabelUse =
  | { readonly kind: "stage"; readonly pipelineId: string; readonly pipelineName: string }
  | {
      readonly kind: "flow";
      readonly flowKey: string;
      readonly flowName: string;
      readonly blockId: string;
      readonly blockName: string;
      /** La pone, la quita o la pregunta (Condicional). */
      readonly how: "adds" | "removes" | "checks";
    }
  | { readonly kind: "broadcast"; readonly id: string; readonly name: string }
  | { readonly kind: "audience"; readonly id: string; readonly name: string }
  | { readonly kind: "webhook"; readonly id: string; readonly name: string }
  | { readonly kind: "groupCampaign"; readonly id: string; readonly name: string };

/** Lo que vendieron en los últimos 30 días quienes la tienen hoy, en una moneda. */
export interface LabelSales {
  readonly currency: string;
  readonly amount: number;
  readonly sales: number;
}

export interface LabelOverview extends LabelSummary {
  readonly uses: ReadonlyArray<LabelUse>;
  /** `null`: quien mira no ve las ventas. Vacío: no vendieron. Una entrada por moneda, la mayor primero. */
  readonly sales: ReadonlyArray<LabelSales> | null;
}

/** Varias etiquetas que son la misma (mayúsculas, tildes o un carácter invisible): se proponen unir en `keepId`. */
export interface LabelDuplicate {
  readonly name: string;
  readonly keepId: string;
  readonly otherIds: ReadonlyArray<string>;
}

export interface LabelMerge {
  readonly id: string;
  readonly fromName: string;
  readonly intoId: string;
  readonly intoName: string;
  /** Clientes que tenía la de origen al empezar, y los que ya pasaron. */
  readonly total: number;
  readonly moved: number;
  readonly status: "running" | "done" | "failed";
  readonly error: string | null;
  readonly createdAt: string;
}

export interface LabelsOverviewResponse {
  readonly labels: ReadonlyArray<LabelOverview>;
  readonly duplicates: ReadonlyArray<LabelDuplicate>;
  /** Las que están pasando ahora y las terminadas hace poco. */
  readonly merges: ReadonlyArray<LabelMerge>;
  /** Dueños y administradores (`contacts.manage`): renombrar, unir y borrar. */
  readonly canManage: boolean;
  /** Quien ve contactos crea etiquetas y les cambia el color (`contacts.write`). */
  readonly canEdit: boolean;
  readonly canSeeSales: boolean;
}

/** Unir `from` en `into`: sus clientes y sus usos pasan a `into`, y `from` se borra. */
export interface MergeLabelsRequest {
  readonly from: string;
  readonly into: string;
}

export interface MergeLabelsResponse {
  readonly merge: LabelMerge;
  /** Flujos que no se pudieron actualizar (alguien los estaba editando): hay que cambiarlos a mano. */
  readonly flowsSkipped: ReadonlyArray<string>;
}

export interface RenameLabelResponse {
  readonly label: LabelSummary;
  readonly flowsSkipped: ReadonlyArray<string>;
}

/** Cuántos clientes pasan por vuelta de la cola: cada uno por el camino de siempre (etapas del CRM incluidas). */
export const LABEL_MERGE_BATCH = 200;
