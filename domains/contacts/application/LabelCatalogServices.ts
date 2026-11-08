import type { LabelRepository } from "./ContactRepository";
import type { Label } from "../domain/Label";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { requireLabelColor, requireLabelName } from "./labelRules";

// ---------------------------------------------------------------------------
// Catálogo de etiquetas de una cuenta: listar, crear, editar y borrar.
// Borrar una etiqueta la quita de todos los contactos (cascada en la base).
// ---------------------------------------------------------------------------

export class ListLabelsService {
  public constructor(private readonly labels: LabelRepository) {}

  public execute(tenantId: string) {
    return this.labels.list(tenantId);
  }
}

export class CreateLabelService {
  public constructor(private readonly labels: LabelRepository) {}

  /** Lanza `ConflictError` si ya existe una con ese nombre. */
  public async execute(tenantId: string, input: { name?: unknown; color?: unknown }): Promise<Label> {
    const label: Label = {
      id: crypto.randomUUID(),
      tenantId,
      name: requireLabelName(input.name),
      color: requireLabelColor(input.color),
      createdAt: new Date().toISOString()
    };
    await this.labels.create(label);
    return label;
  }
}

export class UpdateLabelService {
  public constructor(private readonly labels: LabelRepository) {}

  public async execute(tenantId: string, id: string, input: { name?: unknown; color?: unknown }): Promise<Label> {
    const current = await this.labels.findById(tenantId, id);
    if (!current) throw new NotFoundError("La etiqueta no existe.");

    const next: Label = {
      ...current,
      ...(input.name !== undefined ? { name: requireLabelName(input.name) } : {}),
      ...(input.color !== undefined ? { color: requireLabelColor(input.color) } : {})
    };
    await this.labels.update(next);
    return next;
  }
}

export class DeleteLabelService {
  public constructor(private readonly labels: LabelRepository) {}

  /** Idempotente: borrar una que no existe no falla. */
  public async execute(tenantId: string, id: string): Promise<void> {
    await this.labels.delete(tenantId, id);
  }
}
