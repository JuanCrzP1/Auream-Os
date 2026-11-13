import type { ContactFieldDefinition } from "../../../contracts/ContactFieldContracts";
import type { ContactFieldValue } from "../../../contracts/ContactContracts";
import type { ContactFieldRepository, ContactFieldValues, FieldOrigins, OriginWrite, StoredOrigin } from "../../../domains/contact-fields/application/ContactFieldPorts";
import type { FieldShape } from "../../../domains/contact-fields/domain/ContactField";
import type { ObservedValues } from "../../../domains/contact-fields/domain/fieldDiscovery";

/** Catálogo de campos del cliente en memoria (pruebas). `removed`: las claves borradas, en orden. */
export class InMemoryContactFieldRepository implements ContactFieldRepository {
  private readonly rows: Array<ContactFieldDefinition & { readonly tenantId: string }> = [];
  public readonly removed: string[] = [];

  public async list(tenantId: string): Promise<ContactFieldDefinition[]> {
    return this.rows.filter((row) => row.tenantId === tenantId).map(({ tenantId: _tenant, ...row }) => row);
  }

  public async find(tenantId: string, id: string): Promise<ContactFieldDefinition | null> {
    return (await this.list(tenantId)).find((row) => row.id === id) ?? null;
  }

  public async findByKey(tenantId: string, key: string): Promise<ContactFieldDefinition | null> {
    return (await this.list(tenantId)).find((row) => row.key === key) ?? null;
  }

  public async create(tenantId: string, id: string, field: FieldShape): Promise<ContactFieldDefinition | null> {
    if (this.rows.some((row) => row.tenantId === tenantId && row.key === field.key)) return null;
    const at = new Date().toISOString();
    this.rows.push({ ...field, options: [...field.options], id, tenantId, createdAt: at, updatedAt: at });
    return this.find(tenantId, id);
  }

  public async update(tenantId: string, id: string, field: FieldShape): Promise<ContactFieldDefinition | null> {
    const index = this.rows.findIndex((row) => row.tenantId === tenantId && row.id === id);
    if (index < 0) return null;
    const row = this.rows[index]!;
    this.rows[index] = { ...row, label: field.label, type: field.type, options: [...field.options], updatedAt: new Date().toISOString() };
    return this.find(tenantId, id);
  }

  public async remove(tenantId: string, id: string, key: string): Promise<boolean> {
    const index = this.rows.findIndex((row) => row.tenantId === tenantId && row.id === id);
    if (index < 0) return false;
    this.rows.splice(index, 1);
    this.removed.push(key);
    return true;
  }
}

/** Los datos de los clientes en memoria: `seen` por cuenta; `merged` anota cada escritura. */
export class InMemoryContactFieldValues implements ContactFieldValues {
  private readonly contactsData = new Map<string, Record<string, ContactFieldValue>>();
  public readonly merged: Array<{ readonly tenantId: string; readonly contactId: string; readonly values: Readonly<Record<string, string | number | boolean>> }> = [];

  public constructor(
    private readonly seen: ReadonlyMap<string, ReadonlyMap<string, ObservedValues>> = new Map(),
    private readonly contacts = 0
  ) {}

  public async totalContacts(): Promise<number> {
    return this.contacts;
  }

  public async filledCounts(tenantId: string, keys: ReadonlyArray<string>): Promise<ReadonlyMap<string, number>> {
    const seen = this.seen.get(tenantId);
    return new Map(keys.map((key) => [key, seen?.get(key)?.filled ?? 0]));
  }

  public async observed(tenantId: string): Promise<ReadonlyMap<string, ObservedValues>> {
    return this.seen.get(tenantId) ?? new Map();
  }

  public async merge(tenantId: string, contactId: string, values: Readonly<Record<string, string | number | boolean>>): Promise<void> {
    this.merged.push({ tenantId, contactId, values });
    const current = this.contactsData.get(`${tenantId}:${contactId}`);
    if (current) this.contactsData.set(`${tenantId}:${contactId}`, { ...current, ...values });
  }

  /** Un cliente de la cuenta con sus datos (pruebas). */
  public seedContact(tenantId: string, contactId: string, values: Readonly<Record<string, ContactFieldValue>> = {}): void {
    this.contactsData.set(`${tenantId}:${contactId}`, { ...values });
  }

  public async ofContact(tenantId: string, contactId: string): Promise<Record<string, ContactFieldValue> | null> {
    const current = this.contactsData.get(`${tenantId}:${contactId}`);
    return current ? { ...current } : null;
  }

  public async clear(tenantId: string, contactId: string, keys: ReadonlyArray<string>): Promise<void> {
    const current = this.contactsData.get(`${tenantId}:${contactId}`);
    if (!current) return;
    this.contactsData.set(`${tenantId}:${contactId}`, Object.fromEntries(Object.entries(current).filter(([key]) => !keys.includes(key))));
  }
}

/** Orígenes en memoria (pruebas): el último por cliente y clave. */
export class InMemoryFieldOrigins implements FieldOrigins {
  private readonly rows = new Map<string, StoredOrigin & { readonly tenantId: string; readonly contactId: string }>();
  public constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  public async record(tenantId: string, contactId: string, keys: ReadonlyArray<string>, origin: OriginWrite): Promise<void> {
    for (const key of keys) {
      this.rows.set(`${contactId}:${key}`, {
        tenantId, contactId, key, source: origin.source, at: this.now(),
        flowKey: origin.source === "flow" ? origin.flowKey : null,
        actorId: origin.source === "team" ? origin.actorId : null
      });
    }
  }

  public async forContact(tenantId: string, contactId: string): Promise<ReadonlyArray<StoredOrigin>> {
    return [...this.rows.values()].filter((row) => row.tenantId === tenantId && row.contactId === contactId).map(({ tenantId: _t, contactId: _c, ...row }) => row);
  }

  public async forget(tenantId: string, contactId: string, keys: ReadonlyArray<string>): Promise<void> {
    for (const key of keys) {
      const row = this.rows.get(`${contactId}:${key}`);
      if (row?.tenantId === tenantId) this.rows.delete(`${contactId}:${key}`);
    }
  }
}

/** Valores observados a partir de pares [valor, cuántos] (pruebas y demostración). */
export function observedFrom(values: Readonly<Record<string, ReadonlyArray<readonly [string, number]>>>): ReadonlyMap<string, ObservedValues> {
  return new Map(
    Object.entries(values).map(([key, top]) => [key, { filled: top.reduce((sum, [, n]) => sum + n, 0), distinct: top.length, top: top.map(([value, count]) => ({ value, count })) }])
  );
}
