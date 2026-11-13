import type { LabelMerge, LabelSales, LabelUse } from "../../../contracts/LabelManagementContracts";
import type { BuilderFlowSnapshot } from "../../../contracts/FlowSnapshot";
import type { Label } from "../../contacts/domain/Label";
import type { LabelRename } from "../domain/flowLabels";

// Lo que Etiquetas necesita de fuera: el catálogo (Contactos), quién la usa
// (CRM, difusiones, webhooks, grupos), los flujos, las ventas y la cola.

export interface LabelCatalog {
  list(tenantId: string): Promise<Array<Label & { contactCount: number }>>;
  findById(tenantId: string, id: string): Promise<Label | null>;
  update(label: Label): Promise<void>;
  delete(tenantId: string, id: string): Promise<void>;
}

/** Quién usa cada etiqueta fuera de los flujos. */
export interface LabelReferences {
  /** Por id: la etapa de un embudo, una difusión por enviar, un público guardado. */
  byId(tenantId: string): Promise<ReadonlyArray<{ readonly labelId: string; readonly use: LabelUse }>>;
  /** Por nombre: los webhooks (ponen o quitan) y las campañas de grupos (ponen la de su nombre). */
  byName(tenantId: string): Promise<ReadonlyArray<{ readonly name: string; readonly use: LabelUse }>>;
  /** Lo que vendieron desde `since` quienes la tienen hoy, por moneda. */
  sales(tenantId: string, since: Date): Promise<ReadonlyArray<LabelSales & { readonly labelId: string }>>;
}

/** Cambia la etiqueta en lo que la nombra o la guarda fuera de los flujos (difusiones por enviar, públicos guardados, webhooks). */
export interface LabelReferenceRewriter {
  replace(tenantId: string, from: Pick<Label, "id" | "name">, into: Pick<Label, "id" | "name">): Promise<void>;
  rename(tenantId: string, rename: LabelRename): Promise<void>;
}

/** Los flujos que corren: leerlos y cambiar el nombre de una etiqueta en sus bloques (como un guardado del editor). */
export interface LabelFlows {
  drafts(tenantId: string): Promise<ReadonlyArray<BuilderFlowSnapshot>>;
  /** Devuelve los flujos que no se pudieron guardar (alguien los estaba editando). */
  rename(tenantId: string, rename: LabelRename): Promise<ReadonlyArray<string>>;
}

export interface NewLabelMerge {
  readonly id: string;
  readonly from: Pick<Label, "id" | "name">;
  readonly into: Pick<Label, "id" | "name">;
  readonly total: number;
  readonly createdBy: string;
}

export interface LabelMergeStore {
  /** `null` si esa etiqueta ya se está uniendo. */
  start(tenantId: string, merge: NewLabelMerge): Promise<LabelMerge | null>;
  find(tenantId: string, id: string): Promise<(LabelMerge & { readonly fromId: string }) | null>;
  /** Las que siguen pasando y las que terminaron desde `since`. */
  recent(tenantId: string, since: Date): Promise<ReadonlyArray<LabelMerge>>;
  advance(tenantId: string, id: string, moved: number): Promise<void>;
  finish(tenantId: string, id: string, status: "done" | "failed", error?: string): Promise<void>;
}

/** Los clientes de una etiqueta, y pasarlos a otra por el camino de siempre (etapas del CRM y su historial incluidos). */
export interface LabelHolders {
  holders(tenantId: string, labelId: string, limit: number): Promise<ReadonlyArray<string>>;
  /** `note`: lo que queda en el historial del CRM («Se unió «‎Pagado» en «Pagado»»). */
  move(tenantId: string, contactId: string, fromId: string, intoId: string, note: string): Promise<void>;
}

/** La siguiente vuelta de una unión, en la cola de tareas. */
export interface LabelMergeQueue {
  next(tenantId: string, mergeId: string, round: number): Promise<void>;
}
