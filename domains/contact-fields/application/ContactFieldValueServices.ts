import type { ContactFieldDefinition } from "../../../contracts/ContactFieldContracts";
import type { ContactFieldValue } from "../../../contracts/ContactContracts";
import type { ContactFieldValuesResponse, FieldOrigin } from "../../../contracts/ContactFieldValueContracts";
import type { BuilderFlowSnapshot } from "../../../contracts/FlowSnapshot";
import { joinOptions } from "../../../contracts/FieldValues";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { coerceFieldValue } from "../domain/ContactField";
import { flowKeys } from "../domain/fieldUses";
import type { ContactFieldRepository, ContactFieldValues, FieldOrigins, FlowDrafts, StoredOrigin, TeamNames } from "./ContactFieldPorts";

// ---------------------------------------------------------------------------
// La ficha de UN cliente: sus datos y de dónde salió cada uno, y editarlos.
//
// Editar recibe SOLO lo que cambió (`null` = sin dato) y se mezcla con lo que
// hay: si un flujo guarda otro dato mientras la ficha está abierta, no se
// pisa. Cada valor se valida con el tipo de su campo (la misma regla que al
// guardar desde un flujo). El nombre del bloque y de la persona se buscan al
// leer: un bloque renombrado se ve con su nombre de hoy.
// ---------------------------------------------------------------------------

const MAX_CHANGES = 100;

function problem(field: ContactFieldDefinition): string {
  switch (field.type) {
    case "list":
      return `«${field.label}» debe ser una de estas: ${joinOptions(field.options)}.`;
    case "number":
      return `«${field.label}» debe ser un número.`;
    case "date":
      return `«${field.label}» debe ser una fecha, por ejemplo 13/11/2026.`;
    case "boolean":
      return `«${field.label}» es sí o no.`;
    default:
      return `«${field.label}» no es válido.`;
  }
}

function requireChanges(input: unknown): Readonly<Record<string, unknown>> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ValidationError("Manda los cambios de la ficha.");
  const changes = input as Record<string, unknown>;
  if (Object.keys(changes).length > MAX_CHANGES) throw new ValidationError(`Cambia hasta ${MAX_CHANGES} datos a la vez.`);
  return changes;
}

export class ContactFieldValueServices {
  public constructor(
    private readonly repository: Pick<ContactFieldRepository, "list">,
    private readonly values: Pick<ContactFieldValues, "ofContact" | "merge" | "clear">,
    private readonly origins: FieldOrigins,
    private readonly flows: FlowDrafts,
    private readonly team: TeamNames
  ) {}

  public async read(tenantId: string, contactId: string, canEdit: boolean): Promise<ContactFieldValuesResponse> {
    const stored = await this.values.ofContact(tenantId, contactId);
    if (!stored) throw new NotFoundError("El cliente no existe.");
    const values = Object.fromEntries(Object.entries(stored).filter(([key]) => !key.startsWith("__")));
    const origins = (await this.origins.forContact(tenantId, contactId)).filter((origin) => origin.key in values);
    return { values, origins: await this.describe(tenantId, origins), canEdit };
  }

  public async update(tenantId: string, contactId: string, input: { readonly changes?: unknown }, actorId: string): Promise<ContactFieldValuesResponse> {
    const changes = requireChanges(input.changes);
    if (!(await this.values.ofContact(tenantId, contactId))) throw new NotFoundError("El cliente no existe.");
    const fields = new Map((await this.repository.list(tenantId)).map((field) => [field.key, field]));
    const set: Record<string, ContactFieldValue> = {};
    const cleared: string[] = [];
    for (const [key, raw] of Object.entries(changes)) {
      const field = fields.get(key);
      if (!field) throw new ValidationError(`«${key}» no es un campo del cliente.`);
      if (raw === null || raw === "") {
        cleared.push(key);
        continue;
      }
      const value = coerceFieldValue(field, raw);
      if (value === undefined) throw new ValidationError(problem(field));
      set[key] = value;
    }
    if (Object.keys(set).length > 0) {
      await this.values.merge(tenantId, contactId, set);
      await this.origins.record(tenantId, contactId, Object.keys(set), { source: "team", actorId });
    }
    if (cleared.length > 0) {
      await this.values.clear(tenantId, contactId, cleared);
      await this.origins.forget(tenantId, contactId, cleared);
    }
    return this.read(tenantId, contactId, true);
  }

  /** Cada origen con nombres de hoy: el bloque que llena esa clave en ese flujo (si es uno solo) o la persona. */
  private async describe(tenantId: string, stored: ReadonlyArray<StoredOrigin>): Promise<Record<string, FieldOrigin>> {
    if (stored.length === 0) return {};
    const [drafts, names] = await Promise.all([
      stored.some((origin) => origin.source === "flow") ? this.flows.drafts(tenantId) : Promise.resolve([]),
      stored.some((origin) => origin.source === "team") ? this.team.names(tenantId) : Promise.resolve(new Map<string, string>())
    ]);
    const byFlow = new Map<string, BuilderFlowSnapshot>(drafts.map((draft) => [draft.flow.key, draft]));
    const described: Record<string, FieldOrigin> = {};
    for (const origin of stored) {
      if (origin.source === "team") {
        described[origin.key] = { source: "team", at: origin.at, actorName: (origin.actorId && names.get(origin.actorId)) || null };
        continue;
      }
      const draft = origin.flowKey ? byFlow.get(origin.flowKey) : undefined;
      const fills = draft ? flowKeys(draft).uses.filter((entry) => entry.key === origin.key && entry.use.role === "fills") : [];
      const block = fills.length === 1 ? fills[0]!.use : null;
      described[origin.key] = { source: "flow", at: origin.at, flowName: draft?.flow.name ?? null, blockName: block?.blockName ?? null, blockType: block?.blockType ?? null };
    }
    return described;
  }
}
