import { CONTACT_FIELD_KEY_PATTERN } from "../../../contracts/ContactContracts";
import { RESERVED_FIELD_KEYS, type ContactFieldDefinition } from "../../../contracts/ContactFieldContracts";
import { FIELD_OPERATION_UNDO_DAYS, type FieldOperationResponse, type MergePreview, type UndoOperationResponse } from "../../../contracts/ContactFieldToolsContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { labelFromKey } from "../domain/ContactField";
import { operationSummary } from "../domain/fieldSuggestions";
import { flowKeys } from "../domain/fieldUses";
import type { ContactFieldRepository, ContactFieldValues, FlowDrafts } from "./ContactFieldPorts";
import type { FieldInsights, FieldOperations, FlowRewriter } from "./ContactFieldToolPorts";

// ---------------------------------------------------------------------------
// «Unir campos» y «deshacer». Unir pasa los datos de varias claves a una (si
// un cliente tiene varias, queda la más reciente), borra las definiciones que
// sobran y cambia la clave en los bloques de los flujos. Primero los datos
// (una transacción) y después los flujos: un flujo que alguien esté editando
// se reporta para cambiarlo a mano, no se pisa. Deshacer devuelve todo lo que
// siga como lo dejó la operación, hasta 7 días después.
// ---------------------------------------------------------------------------

const MAX_MERGE = 10;
const DAY_MS = 86_400_000;

interface MergeInput {
  readonly keep: string;
  readonly merge: string[];
}

function requireMerge(input: unknown): MergeInput {
  const body = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const keep = typeof body["keep"] === "string" ? body["keep"].trim() : "";
  const merge = [...new Set((Array.isArray(body["merge"]) ? body["merge"] : []).filter((key): key is string => typeof key === "string").map((key) => key.trim()))].filter((key) => key && key !== keep);
  if (!CONTACT_FIELD_KEY_PATTERN.test(keep)) throw new ValidationError("Elige con cuál campo te quedas.");
  if (merge.length === 0) throw new ValidationError("Elige al menos otro campo para unir.");
  if (merge.length > MAX_MERGE) throw new ValidationError(`Une hasta ${MAX_MERGE} campos a la vez.`);
  for (const key of [keep, ...merge]) {
    if (!CONTACT_FIELD_KEY_PATTERN.test(key)) throw new ValidationError(`«${key}» no es una clave válida.`);
    if (RESERVED_FIELD_KEYS.has(key.toLowerCase())) throw new ValidationError(`«{${key}}» lo llena Auream: no se puede unir.`);
  }
  return { keep, merge };
}

export class ContactFieldMergeServices {
  public constructor(
    private readonly repository: Pick<ContactFieldRepository, "list">,
    private readonly counts: Pick<ContactFieldValues, "filledCounts">,
    private readonly insights: Pick<FieldInsights, "conflicts">,
    private readonly operations: FieldOperations,
    private readonly flows: FlowDrafts,
    private readonly rewriter: FlowRewriter,
    private readonly newId: () => string,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async preview(tenantId: string, input: unknown): Promise<MergePreview> {
    const { keep, merge } = requireMerge(input);
    const keys = [keep, ...merge];
    const [definitions, filled, conflicts, drafts] = await Promise.all([
      this.repository.list(tenantId),
      this.counts.filledCounts(tenantId, keys),
      this.insights.conflicts(tenantId, keys),
      this.flows.drafts(tenantId)
    ]);
    const uses = drafts.flatMap((draft) => flowKeys(draft).uses);
    const labelOf = (key: string) => definitions.find((field) => field.key === key)?.label ?? null;
    return {
      keys: keys.map((key) => ({ key, label: labelOf(key), filled: filled.get(key) ?? 0, blocks: uses.filter((entry) => entry.key === key).length })),
      blocks: uses.filter((entry) => merge.includes(entry.key)).map((entry) => ({ ...entry.use, key: entry.key })),
      conflicts
    };
  }

  public async merge(tenantId: string, input: unknown, actorId: string): Promise<FieldOperationResponse> {
    const { keep, merge } = requireMerge(input);
    const definitions = await this.repository.list(tenantId);
    const merged = definitions.filter((field) => merge.includes(field.key));
    const kept = definitions.find((field) => field.key === keep);
    // Si la clave que queda aún no era un campo, hereda el tipo del primero que se une.
    const inherit: ContactFieldDefinition | undefined = merged[0];
    const createKeep = kept ? null : { id: this.newId(), shape: { key: keep, label: labelFromKey(keep), type: inherit?.type ?? ("text" as const), options: inherit?.options ?? [] } };
    const operationId = this.newId();
    const title = `Uniste ${merge.length + 1} campos en «${kept?.label ?? createKeep!.shape.label}»`;

    const contacts = await this.operations.merge(tenantId, { operationId, title, actorId, keep, merge, merged, createKeep });
    const rewritten = await this.rewriter.rename(tenantId, new Map(merge.map((key) => [key, keep])));
    if (rewritten.changes.length > 0) await this.operations.attachFlows(tenantId, operationId, rewritten.changes);
    return {
      operation: operationSummary({ id: operationId, kind: "merge", title, contacts, keys: [keep, ...merge], definitions: { restore: [], remove: [] }, flows: [], createdAt: this.now().toISOString(), undoneAt: null }),
      flowsSkipped: rewritten.skipped
    };
  }

  public async undo(tenantId: string, operationId: string): Promise<UndoOperationResponse> {
    const operation = await this.operations.find(tenantId, operationId);
    if (!operation) throw new NotFoundError("Esa operación no existe.");
    if (operation.undoneAt) throw new ValidationError("Eso ya se deshizo.");
    if (this.now().getTime() - Date.parse(operation.createdAt) > FIELD_OPERATION_UNDO_DAYS * DAY_MS) {
      throw new ValidationError(`Solo se puede deshacer durante ${FIELD_OPERATION_UNDO_DAYS} días.`);
    }
    const contacts = await this.operations.undo(tenantId, operation);
    if (contacts === null) throw new ValidationError("Eso ya se deshizo.");
    const flows = operation.flows.length > 0 ? await this.rewriter.restore(tenantId, operation.flows) : { skipped: 0 };
    return { contacts, blocksSkipped: flows.skipped };
  }
}
