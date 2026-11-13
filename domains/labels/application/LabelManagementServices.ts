import { randomUUID } from "node:crypto";
import type { LabelOverview, LabelsOverviewResponse, LabelUse, MergeLabelsResponse, RenameLabelResponse } from "../../../contracts/LabelManagementContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { AccessError } from "../../../platform/authorization/domain/AccessError";
import { requireLabelColor, requireLabelName } from "../../contacts/application/labelRules";
import { labelKey } from "../../contacts/domain/Label";
import { flowLabelUses } from "../domain/flowLabels";
import { deleteProblem, duplicatesOf, mergeProblem, type LabelFacts } from "../domain/labelRules";
import type { LabelCatalog, LabelFlows, LabelMergeQueue, LabelMergeStore, LabelReferenceRewriter, LabelReferences } from "./LabelManagementPorts";

// ---------------------------------------------------------------------------
// Etiquetas: el catálogo con lo que importa para decidir (clientes, lo que
// vendieron en 30 días, quién la usa y las repetidas), cambiarle el nombre
// sin romper los flujos que la nombran, y unir una en otra (o «pasar y
// borrar»): primero cambian sus usos, luego sus clientes pasan por tandas
// (`LabelMergeRunner`) y al final se borra. Todo filtra por cuenta.
// ---------------------------------------------------------------------------

export interface LabelActor {
  readonly tenantId: string;
  readonly actorId: string;
  /** Renombrar, unir y borrar (`contacts.manage`). */
  readonly canManage: boolean;
  /** Crear y cambiar el color (`contacts.write`). */
  readonly canEdit: boolean;
  readonly canSeeSales: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 86_400_000;
const RECENT_MERGES_MS = DAY;

export class LabelManagementServices {
  public constructor(
    private readonly catalog: LabelCatalog,
    private readonly references: LabelReferences,
    private readonly flows: LabelFlows,
    private readonly rewriter: LabelReferenceRewriter,
    private readonly merges: LabelMergeStore,
    private readonly queue: LabelMergeQueue,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: () => string = randomUUID
  ) {}

  public async overview(actor: LabelActor): Promise<LabelsOverviewResponse> {
    const labels = await this.facts(actor.tenantId);
    const sales = actor.canSeeSales ? await this.references.sales(actor.tenantId, new Date(this.now().getTime() - 30 * DAY)) : null;
    const overview: LabelOverview[] = labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
      contactCount: label.contactCount,
      uses: label.uses,
      sales: sales ? sales.filter((row) => row.labelId === label.id).map(({ currency, amount, sales: count }) => ({ currency, amount, sales: count })).sort((a, b) => b.amount - a.amount) : null
    }));
    return {
      labels: overview,
      duplicates: duplicatesOf(labels),
      merges: await this.merges.recent(actor.tenantId, new Date(this.now().getTime() - RECENT_MERGES_MS)),
      canManage: actor.canManage,
      canEdit: actor.canEdit,
      canSeeSales: actor.canSeeSales
    };
  }

  /** Color: quien edita contactos. Nombre: dueños y administradores, y cambia en los flujos y webhooks que la nombran. */
  public async update(actor: LabelActor, id: string, input: { readonly name?: unknown; readonly color?: unknown }): Promise<RenameLabelResponse> {
    const current = await this.require(actor.tenantId, id);
    const name = input.name === undefined ? current.name : requireLabelName(input.name);
    const color = input.color === undefined ? current.color : requireLabelColor(input.color);
    const renamed = name !== current.name;
    if (renamed && !actor.canManage) throw new AccessError("Cambiar el nombre de una etiqueta es de dueños y administradores: los flujos la usan por su nombre.");
    if (!renamed && !actor.canEdit) throw new AccessError("No puedes cambiar etiquetas.");
    const label = { ...current, name, color };
    await this.catalog.update(label);
    let flowsSkipped: ReadonlyArray<string> = [];
    if (renamed && labelKey(name) !== labelKey(current.name)) {
      const rename = { from: [current.name], to: name };
      flowsSkipped = await this.flows.rename(actor.tenantId, rename);
      await this.rewriter.rename(actor.tenantId, rename);
    }
    return { label: { id: label.id, name: label.name, color: label.color }, flowsSkipped };
  }

  /** Une `from` en `into`: sus usos cambian ya; sus clientes pasan por tandas en la cola; al final `from` se borra. */
  public async merge(actor: LabelActor, input: { readonly from?: unknown; readonly into?: unknown }): Promise<MergeLabelsResponse> {
    this.requireManage(actor);
    const labels = await this.facts(actor.tenantId);
    const find = (value: unknown) => (typeof value === "string" ? labels.find((label) => label.id === value) : undefined);
    const from = find(input.from);
    const into = find(input.into);
    if (!from || !into) throw new NotFoundError("Esa etiqueta ya no existe.");
    const problem = mergeProblem(from, into);
    if (problem) throw new ValidationError(problem);
    const merge = await this.merges.start(actor.tenantId, { id: this.newId(), from, into, total: from.contactCount, createdBy: actor.actorId });
    if (!merge) throw new ValidationError(`«${from.name}» ya se está uniendo: espera a que termine.`);
    // Primero los usos: desde ya, los flujos ponen la nueva y nadie vuelve a poner la vieja.
    const rename = { from: [from.name], to: into.name };
    const flowsSkipped = await this.flows.rename(actor.tenantId, rename);
    await this.rewriter.replace(actor.tenantId, from, into);
    await this.queue.next(actor.tenantId, merge.id, 0);
    return { merge, flowsSkipped };
  }

  /** Sin `into`, solo si nadie la usa (sus clientes la pierden). Con `into`, es unir y borrar. */
  public async remove(actor: LabelActor, id: string, into: string | null): Promise<MergeLabelsResponse | null> {
    this.requireManage(actor);
    if (into) return this.merge(actor, { from: id, into });
    const label = (await this.facts(actor.tenantId)).find((item) => item.id === id);
    if (!label) throw new NotFoundError("Esa etiqueta ya no existe.");
    const problem = deleteProblem(label);
    if (problem) throw new ValidationError(problem);
    await this.catalog.delete(actor.tenantId, id);
    return null;
  }

  private requireManage(actor: LabelActor): void {
    if (!actor.canManage) throw new AccessError("Unir y borrar etiquetas es de dueños y administradores.");
  }

  private async require(tenantId: string, id: string) {
    const label = UUID.test(id) ? await this.catalog.findById(tenantId, id) : null;
    if (!label) throw new NotFoundError("Esa etiqueta ya no existe.");
    return label;
  }

  /** Cada etiqueta con sus clientes y quién la usa (por id y por nombre). */
  private async facts(tenantId: string): Promise<Array<LabelFacts & { readonly color: string }>> {
    const [labels, byId, byName, drafts] = await Promise.all([this.catalog.list(tenantId), this.references.byId(tenantId), this.references.byName(tenantId), this.flows.drafts(tenantId)]);
    const inFlows = flowLabelUses(drafts);
    // Lo que nombra una etiqueta (flujos, webhooks, grupos) va a la más antigua de las que se leen igual: la que de verdad reciben.
    const owner = new Map<string, string>();
    for (const label of [...labels].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) {
      if (!owner.has(labelKey(label.name))) owner.set(labelKey(label.name), label.id);
    }
    return labels.map((label) => {
      const key = labelKey(label.name);
      const named = owner.get(key) === label.id;
      const uses: LabelUse[] = [
        ...byId.filter((row) => row.labelId === label.id).map((row) => row.use),
        ...(named ? (inFlows.get(key) ?? []) : []),
        ...(named ? byName.filter((row) => labelKey(row.name) === key).map((row) => row.use) : [])
      ];
      return { id: label.id, name: label.name, color: label.color, contactCount: label.contactCount, uses };
    });
  }
}
