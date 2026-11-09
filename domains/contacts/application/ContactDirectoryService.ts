import type { ContactFieldValue, ContactIdentity, ContactProfile } from "../../../contracts/ContactContracts";
import { DEFAULT_LABEL_COLOR } from "../../../contracts/ContactContracts";
import type { ContactRepository, ContactWithLabels, LabelRepository } from "./ContactRepository";
import { isValidCustomFieldValue, normalizeExternalKey, type Contact } from "../domain/Contact";
import { labelKey, normalizeLabelName } from "../domain/Label";

// ---------------------------------------------------------------------------
// ContactDirectoryService — lo que el MOTOR necesita de Contactos mientras
// ejecuta un flujo. Satisface estructuralmente el puerto
// `flow-engine/ports/ContactDirectory` (los dominios no importan el motor).
//
//   resolve      el contacto de la conversación; si es la primera vez que
//                escribe, se crea (en WhatsApp la clave es su teléfono).
//   addTags      por NOMBRE (lo que guarda el bloque Etiquetas). Una etiqueta
//                que aún no está en el catálogo se crea, para que un flujo no
//                se rompa porque alguien la borró; queda en el catálogo.
//   removeTags   por nombre; las que no tiene se ignoran.
//   setFields    guarda campos personalizados (los usan Integración, IA…).
// ---------------------------------------------------------------------------

function toProfile({ contact, labels }: ContactWithLabels): ContactProfile {
  return {
    id: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    tags: labels.map((label) => label.name),
    fields: contact.customFields
  };
}

export class ContactDirectoryService {
  public constructor(
    private readonly contacts: ContactRepository,
    private readonly labels: LabelRepository
  ) {}

  public async resolve(tenantId: string, identity: ContactIdentity): Promise<ContactProfile> {
    return (await this.identify(tenantId, identity, null)).profile;
  }

  /**
   * Como `resolve`, diciendo además si el contacto es nuevo (lo usan los
   * disparadores de «primer mensaje»). Un contacto nuevo nace con el nombre
   * de su perfil de WhatsApp, si llega; uno existente sin nombre lo recibe.
   */
  public async identify(tenantId: string, identity: ContactIdentity, displayName: string | null): Promise<{ readonly profile: ContactProfile; readonly isNew: boolean }> {
    const externalKey = normalizeExternalKey(identity.channel, identity.externalKey);
    const name = displayName?.trim().slice(0, 120) || null;
    const existing = await this.contacts.findByIdentity(tenantId, identity.channel, externalKey);
    if (existing) {
      if (!existing.contact.name && name) {
        await this.contacts.update({ ...existing.contact, name, updatedAt: new Date().toISOString() });
        return { profile: { ...toProfile(existing), name }, isNew: false };
      }
      return { profile: toProfile(existing), isNew: false };
    }

    const now = new Date().toISOString();
    const contact: Contact = {
      id: crypto.randomUUID(),
      tenantId,
      channel: identity.channel,
      externalKey,
      name,
      phone: identity.channel === "whatsapp" ? externalKey : null,
      email: null,
      customFields: {},
      createdAt: now,
      updatedAt: now
    };
    // Si otro mensaje lo creó a la vez, `create` devuelve el existente: no es nuevo.
    const stored = await this.contacts.create(contact);
    return { profile: toProfile(stored), isNew: stored.contact.id === contact.id };
  }

  public async addTags(tenantId: string, contactId: string, names: ReadonlyArray<string>): Promise<ContactProfile> {
    const ids = await this.labelIds(tenantId, names, true);
    await this.contacts.changeLabels(tenantId, contactId, { add: ids, remove: [] });
    return this.profile(tenantId, contactId);
  }

  public async removeTags(tenantId: string, contactId: string, names: ReadonlyArray<string>): Promise<ContactProfile> {
    const ids = await this.labelIds(tenantId, names, false);
    await this.contacts.changeLabels(tenantId, contactId, { add: [], remove: ids });
    return this.profile(tenantId, contactId);
  }

  public async setFields(tenantId: string, contactId: string, fields: Readonly<Record<string, unknown>>): Promise<ContactProfile> {
    const current = await this.contacts.findById(tenantId, contactId);
    if (!current) throw new Error(`Contacto inexistente: ${contactId}`);
    const valid = Object.entries(fields).filter(([, value]) => isValidCustomFieldValue(value)) as Array<[string, ContactFieldValue]>;
    const next: Contact = {
      ...current.contact,
      customFields: { ...current.contact.customFields, ...Object.fromEntries(valid) },
      updatedAt: new Date().toISOString()
    };
    await this.contacts.update(next);
    return toProfile({ contact: next, labels: current.labels });
  }

  private async profile(tenantId: string, contactId: string): Promise<ContactProfile> {
    const found = await this.contacts.findById(tenantId, contactId);
    if (!found) throw new Error(`Contacto inexistente: ${contactId}`);
    return toProfile(found);
  }

  /** Ids del catálogo para esos nombres; con `create`, crea las que falten. */
  private async labelIds(tenantId: string, names: ReadonlyArray<string>, create: boolean): Promise<string[]> {
    const wanted = [...new Map(names.map((name) => normalizeLabelName(name)).filter(Boolean).map((name) => [labelKey(name), name])).values()];
    if (wanted.length === 0) return [];

    const found = await this.labels.findByNames(tenantId, wanted);
    const byKey = new Map(found.map((label) => [labelKey(label.name), label.id]));
    if (create) {
      for (const name of wanted) {
        if (byKey.has(labelKey(name))) continue;
        const id = crypto.randomUUID();
        try {
          await this.labels.create({ id, tenantId, name, color: DEFAULT_LABEL_COLOR, createdAt: new Date().toISOString() });
          byKey.set(labelKey(name), id);
        } catch {
          // Otra ejecución la creó a la vez: se usa esa.
          const [again] = await this.labels.findByNames(tenantId, [name]);
          if (again) byKey.set(labelKey(name), again.id);
        }
      }
    }
    return wanted.map((name) => byKey.get(labelKey(name))).filter((id): id is string => id !== undefined);
  }
}
