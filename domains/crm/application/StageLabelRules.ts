import type { PipelineRepository } from "./CrmRepositories";

// ---------------------------------------------------------------------------
// StageLabelRules — le dice a Contactos qué etiquetas son excluyentes entre
// sí: las etapas de un mismo embudo. Así un cliente está en UNA etapa por
// embudo, venga la etiqueta de un flujo, del chat o del tablero. Cumple el
// puerto `ExclusiveLabelGroups` de Contactos (sin importarlo).
// ---------------------------------------------------------------------------

export class StageLabelRules {
  public constructor(private readonly pipelines: PipelineRepository) {}

  /** Por cada embudo que tiene alguna de estas etiquetas como etapa, todas sus etiquetas de etapa. */
  public async groupsOf(tenantId: string, labelIds: ReadonlyArray<string>): Promise<ReadonlyArray<ReadonlyArray<string>>> {
    // Corre en cada cambio de etiquetas (también en los flujos): una sola consulta.
    return labelIds.length === 0 ? [] : this.pipelines.stageLabelGroups(tenantId, labelIds);
  }
}
