import { randomUUID } from "node:crypto";
import {
  CONTACT_FIELD_LIMITS,
  RESERVED_FIELD_KEYS,
  SYSTEM_CONTACT_FIELDS,
  type ContactFieldDefinition,
  type ContactFieldsResponse,
  type ContactFieldSummary,
  type DiscoveredField,
  type DiscoveryResponse
} from "../../../contracts/ContactFieldContracts";
import { CONTACT_FIELD_KEY_PATTERN } from "../../../contracts/ContactContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { labelFromKey, requireFieldChanges, requireNewField } from "../domain/ContactField";
import { looksAlike, suggestType } from "../domain/fieldDiscovery";
import { flowKeys, isTechnicalKey, usesOf, type KeyUse } from "../domain/fieldUses";
import type { ContactFieldRepository, ContactFieldValues, FlowDrafts } from "./ContactFieldPorts";

// ---------------------------------------------------------------------------
// Campos del cliente: el catálogo de la cuenta (nombre, clave, tipo), con lo
// que importa para decidir: en cuántos clientes está y qué bloques lo llenan
// o lo leen. También «el primer día»: los datos que tus flujos e
// integraciones ya guardan y aún no son campos, con el tipo que proponemos.
// Todo filtra por cuenta. Editar es de dueños y administradores (la ruta).
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ADOPT = 50;

type FieldInput = { readonly label?: unknown; readonly key?: unknown; readonly type?: unknown; readonly options?: unknown };

export class ContactFieldServices {
  public constructor(
    private readonly repository: ContactFieldRepository,
    private readonly values: ContactFieldValues,
    private readonly flows: FlowDrafts,
    private readonly newId: () => string = randomUUID
  ) {}

  public async list(tenantId: string, canManage: boolean): Promise<ContactFieldsResponse> {
    const [definitions, uses, totalContacts] = await Promise.all([this.repository.list(tenantId), this.uses(tenantId), this.values.totalContacts(tenantId)]);
    const counts = await this.values.filledCounts(tenantId, definitions.map((field) => field.key));
    const fields: ContactFieldSummary[] = definitions.map((field) => ({ ...field, filled: counts.get(field.key) ?? 0, uses: usesOf(uses.uses, field.key) }));
    const pending = (await this.discoverFrom(tenantId, definitions, uses)).filter((field) => !field.technical).length;
    return { fields, system: SYSTEM_CONTACT_FIELDS, totalContacts, undefinedKeys: pending, canManage };
  }

  public async discover(tenantId: string): Promise<DiscoveryResponse> {
    const [definitions, uses] = await Promise.all([this.repository.list(tenantId), this.uses(tenantId)]);
    return { suggestions: await this.discoverFrom(tenantId, definitions, uses) };
  }

  public async create(tenantId: string, input: FieldInput): Promise<ContactFieldDefinition> {
    const field = requireNewField(input);
    await this.ensureRoom(tenantId, 1);
    const created = await this.repository.create(tenantId, this.newId(), field);
    if (!created) throw new ValidationError(`Ya hay un campo con la clave {${field.key}}.`);
    return created;
  }

  /** Convierte en campos varios datos que ya existen (el primer día). Todo o nada se valida antes de guardar. */
  public async adopt(tenantId: string, input: { readonly fields?: unknown }): Promise<ContactFieldDefinition[]> {
    const list = Array.isArray(input.fields) ? (input.fields as FieldInput[]) : [];
    if (list.length === 0) throw new ValidationError("Elige al menos un dato para convertir en campo.");
    if (list.length > MAX_ADOPT) throw new ValidationError(`Convierte hasta ${MAX_ADOPT} datos a la vez.`);
    const fields = list.map((item) => requireNewField(item));
    await this.ensureRoom(tenantId, fields.length);
    const created: ContactFieldDefinition[] = [];
    for (const field of fields) {
      const saved = await this.repository.create(tenantId, this.newId(), field);
      if (saved) created.push(saved);
    }
    return created;
  }

  public async update(tenantId: string, id: string, input: FieldInput): Promise<ContactFieldDefinition> {
    const current = UUID.test(id) ? await this.repository.find(tenantId, id) : null;
    if (!current) throw new NotFoundError("Ese campo ya no existe.");
    const updated = await this.repository.update(tenantId, id, requireFieldChanges(current, input));
    if (!updated) throw new NotFoundError("Ese campo ya no existe.");
    return updated;
  }

  /** Borra el campo y su dato en todos los clientes: hay que escribir la clave para confirmar. */
  public async remove(tenantId: string, id: string, confirm: unknown): Promise<void> {
    const current = UUID.test(id) ? await this.repository.find(tenantId, id) : null;
    if (!current) throw new NotFoundError("Ese campo ya no existe.");
    if (typeof confirm !== "string" || confirm.trim() !== current.key) {
      throw new ValidationError(`Para borrarlo escribe «${current.key}»: se pierde el dato de todos los clientes.`);
    }
    if (!(await this.repository.remove(tenantId, id, current.key))) throw new NotFoundError("Ese campo ya no existe.");
  }

  private async ensureRoom(tenantId: string, adding: number): Promise<void> {
    const count = (await this.repository.list(tenantId)).length;
    if (count + adding > CONTACT_FIELD_LIMITS.maxFields) {
      throw new ValidationError(`La cuenta admite hasta ${CONTACT_FIELD_LIMITS.maxFields} campos. Borra los que no uses.`);
    }
  }

  private async uses(tenantId: string): Promise<{ readonly uses: KeyUse[]; readonly technical: Set<string> }> {
    const uses: KeyUse[] = [];
    const technical = new Set<string>();
    for (const draft of await this.flows.drafts(tenantId)) {
      const found = flowKeys(draft);
      uses.push(...found.uses);
      for (const key of found.technical) technical.add(key);
    }
    return { uses, technical };
  }

  /** Los datos que ya se guardan (en clientes o por bloques) y aún no son campos. */
  private async discoverFrom(
    tenantId: string,
    definitions: ReadonlyArray<ContactFieldDefinition>,
    flows: { readonly uses: ReadonlyArray<KeyUse>; readonly technical: ReadonlySet<string> }
  ): Promise<DiscoveredField[]> {
    const observed = await this.values.observed(tenantId);
    const defined = new Set(definitions.map((field) => field.key));
    const filledByFlows = flows.uses.filter((entry) => entry.use.role === "fills").map((entry) => entry.key);
    const keys = [...new Set([...observed.keys(), ...filledByFlows])].filter(
      // Solo claves que se pueden convertir (una integración puede guardar «mi dato» con espacio).
      (key) => !defined.has(key) && !RESERVED_FIELD_KEYS.has(key.toLowerCase()) && !key.startsWith("__") && key.length <= 64 && CONTACT_FIELD_KEY_PATTERN.test(key)
    );
    const all = [...keys, ...defined];
    return keys
      .map((key): DiscoveredField => {
        const values = observed.get(key) ?? { filled: 0, distinct: 0, top: [] };
        const suggestion = suggestType(values);
        return {
          key,
          suggestedLabel: labelFromKey(key),
          suggestedType: suggestion.type,
          suggestedOptions: suggestion.options,
          filled: values.filled,
          distinctValues: values.distinct,
          uses: usesOf(flows.uses, key),
          similarTo: all.filter((other) => looksAlike(key, other)),
          technical: isTechnicalKey(key, flows.technical)
        };
      })
      .sort((a, b) => Number(a.technical) - Number(b.technical) || b.filled - a.filled || b.uses.length - a.uses.length || a.key.localeCompare(b.key));
  }
}
