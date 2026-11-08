import type { ContactQuery, ContactRepository, ContactWithLabels, LabelRepository } from "../../../domains/contacts/application/ContactRepository";
import type { Contact } from "../../../domains/contacts/domain/Contact";
import { labelKey, type Label } from "../../../domains/contacts/domain/Label";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";

// ---------------------------------------------------------------------------
// Contactos y etiquetas en memoria: para la simulación del builder (probar un
// flujo no debe crear contactos ni etiquetas reales) y para pruebas. Mismas
// reglas que la versión SQL: por cuenta, nombres de etiqueta únicos.
// ---------------------------------------------------------------------------

/** Almacén compartido por los dos repositorios. */
export class InMemoryContactsStore {
  public readonly contacts = new Map<string, Contact>();
  public readonly labels = new Map<string, Label>();
  /** contactId → ids de etiqueta. */
  public readonly assignments = new Map<string, Set<string>>();
}

export class InMemoryContactRepository implements ContactRepository {
  public constructor(private readonly store: InMemoryContactsStore) {}

  private withLabels(contact: Contact): ContactWithLabels {
    const ids = this.store.assignments.get(contact.id) ?? new Set();
    const labels = [...ids].map((id) => this.store.labels.get(id)).filter((label): label is Label => label !== undefined && label.tenantId === contact.tenantId);
    return { contact, labels: labels.sort((a, b) => a.name.localeCompare(b.name)) };
  }

  public async list(tenantId: string, query: ContactQuery) {
    const term = query.search?.toLowerCase();
    const all = [...this.store.contacts.values()]
      .filter((contact) => contact.tenantId === tenantId)
      .filter((contact) => !term || [contact.name, contact.phone, contact.email].some((value) => value?.toLowerCase().includes(term)))
      .filter((contact) => !query.labelId || (this.store.assignments.get(contact.id)?.has(query.labelId) ?? false))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const start = (query.page - 1) * query.limit;
    return { items: all.slice(start, start + query.limit).map((contact) => this.withLabels(contact)), hasMore: all.length > start + query.limit };
  }

  public async findById(tenantId: string, id: string) {
    const contact = this.store.contacts.get(id);
    return contact && contact.tenantId === tenantId ? this.withLabels(contact) : null;
  }

  public async findByIdentity(tenantId: string, channel: string, externalKey: string) {
    const contact = [...this.store.contacts.values()].find((c) => c.tenantId === tenantId && c.channel === channel && c.externalKey === externalKey);
    return contact ? this.withLabels(contact) : null;
  }

  public async create(contact: Contact) {
    const existing = await this.findByIdentity(contact.tenantId, contact.channel, contact.externalKey);
    if (existing) return existing;
    this.store.contacts.set(contact.id, contact);
    return this.withLabels(contact);
  }

  public async update(contact: Contact) {
    const current = this.store.contacts.get(contact.id);
    if (current && current.tenantId === contact.tenantId) this.store.contacts.set(contact.id, contact);
  }

  private ownLabel(tenantId: string, labelId: string): boolean {
    return this.store.labels.get(labelId)?.tenantId === tenantId;
  }

  public async setLabels(tenantId: string, contactId: string, labelIds: ReadonlyArray<string>) {
    if (!(await this.findById(tenantId, contactId))) return;
    this.store.assignments.set(contactId, new Set(labelIds.filter((id) => this.ownLabel(tenantId, id))));
  }

  public async changeLabels(tenantId: string, contactId: string, change: { add: ReadonlyArray<string>; remove: ReadonlyArray<string> }) {
    if (!(await this.findById(tenantId, contactId))) return;
    const current = new Set(this.store.assignments.get(contactId) ?? []);
    change.remove.forEach((id) => current.delete(id));
    change.add.filter((id) => this.ownLabel(tenantId, id)).forEach((id) => current.add(id));
    this.store.assignments.set(contactId, current);
  }
}

export class InMemoryLabelRepository implements LabelRepository {
  public constructor(private readonly store: InMemoryContactsStore) {}

  private ofTenant(tenantId: string): Label[] {
    return [...this.store.labels.values()].filter((label) => label.tenantId === tenantId);
  }

  public async list(tenantId: string) {
    return this.ofTenant(tenantId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((label) => ({ ...label, contactCount: [...this.store.assignments.values()].filter((ids) => ids.has(label.id)).length }));
  }

  public async findById(tenantId: string, id: string) {
    const label = this.store.labels.get(id);
    return label && label.tenantId === tenantId ? label : null;
  }

  public async findByNames(tenantId: string, names: ReadonlyArray<string>) {
    const keys = new Set(names.map(labelKey));
    return this.ofTenant(tenantId).filter((label) => keys.has(labelKey(label.name)));
  }

  public async create(label: Label) {
    if (this.ofTenant(label.tenantId).some((existing) => labelKey(existing.name) === labelKey(label.name))) {
      throw new ConflictError(`Ya existe una etiqueta llamada «${label.name}».`);
    }
    this.store.labels.set(label.id, label);
  }

  public async update(label: Label) {
    if (this.ofTenant(label.tenantId).some((existing) => existing.id !== label.id && labelKey(existing.name) === labelKey(label.name))) {
      throw new ConflictError(`Ya existe una etiqueta llamada «${label.name}».`);
    }
    if (this.store.labels.get(label.id)?.tenantId === label.tenantId) this.store.labels.set(label.id, label);
  }

  public async delete(tenantId: string, id: string) {
    if (this.store.labels.get(id)?.tenantId !== tenantId) return;
    this.store.labels.delete(id);
    this.store.assignments.forEach((ids) => ids.delete(id));
  }
}
