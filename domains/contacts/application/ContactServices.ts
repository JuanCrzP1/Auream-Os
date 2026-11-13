import type { ContactFieldValue } from "../../../contracts/ContactContracts";
import { readFieldFilters } from "../../../contracts/ContactFieldFilters";
import type { ContactRepository, ContactWithLabels, LabelRepository } from "./ContactRepository";
import type { LabelChangeOrigin } from "./LabelHooks";
import { CUSTOM_FIELD_KEY, isValidCustomFieldValue, normalizeEmail, normalizeExternalKey, type Contact } from "../domain/Contact";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Administración de contactos desde la pantalla de Contactos: listar, ver,
// crear, editar datos y campos, y asignar etiquetas del catálogo.
// ---------------------------------------------------------------------------

const MAX_PAGE_SIZE = 100;

export class ListContactsService {
  public constructor(private readonly contacts: ContactRepository) {}

  public execute(tenantId: string, query: { search?: string; labelId?: string; fields?: unknown; page?: number; limit?: number }) {
    const fields = readFieldFilters(query.fields);
    if (!fields.ok) throw new ValidationError(fields.message);
    const page = Number.isInteger(query.page) && (query.page as number) > 0 ? (query.page as number) : 1;
    const limit = Number.isInteger(query.limit) ? Math.min(Math.max(query.limit as number, 1), MAX_PAGE_SIZE) : 25;
    return this.contacts.list(tenantId, {
      ...(query.search?.trim() ? { search: query.search.trim() } : {}),
      ...(query.labelId ? { labelId: query.labelId } : {}),
      ...(fields.filters.length > 0 ? { fields: fields.filters } : {}),
      page,
      limit
    });
  }
}

export class GetContactService {
  public constructor(private readonly contacts: ContactRepository) {}

  public async execute(tenantId: string, id: string): Promise<ContactWithLabels> {
    const found = await this.contacts.findById(tenantId, id);
    if (!found) throw new NotFoundError("El contacto no existe.");
    return found;
  }
}

/** Valida y normaliza los campos personalizados (o `ValidationError`). */
export function requireCustomFields(fields: unknown): Record<string, ContactFieldValue> {
  if (typeof fields !== "object" || fields === null || Array.isArray(fields)) throw new ValidationError("Los campos personalizados deben ser un objeto.");
  const entries = Object.entries(fields as Record<string, unknown>);
  if (entries.length > 200) throw new ValidationError("Un contacto admite como máximo 200 campos personalizados.");
  for (const [key, value] of entries) {
    if (!CUSTOM_FIELD_KEY.test(key)) throw new ValidationError(`Nombre de campo inválido: «${key}».`);
    if (!isValidCustomFieldValue(value)) throw new ValidationError(`Valor inválido en el campo «${key}».`);
  }
  return Object.fromEntries(entries) as Record<string, ContactFieldValue>;
}

export class CreateContactService {
  public constructor(private readonly contacts: ContactRepository) {}

  /** Alta manual de un contacto de WhatsApp. Si el teléfono ya existe, devuelve ese contacto. */
  public async execute(tenantId: string, input: { name?: unknown; phone?: unknown; email?: unknown }, origin?: LabelChangeOrigin): Promise<ContactWithLabels> {
    const phone = typeof input.phone === "string" ? normalizeExternalKey("whatsapp", input.phone) : "";
    if (phone.length < 7 || phone.length > 15) throw new ValidationError("Indica un teléfono con código de país (7 a 15 dígitos).");
    const email = input.email === undefined || input.email === "" ? null : normalizeEmail(String(input.email));
    if (input.email && email === null) throw new ValidationError("El correo no es válido.");

    const now = new Date().toISOString();
    const contact: Contact = {
      id: crypto.randomUUID(),
      tenantId,
      channel: "whatsapp",
      externalKey: phone,
      name: typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 120) : null,
      phone,
      email,
      customFields: {},
      createdAt: now,
      updatedAt: now
    };
    return this.contacts.create(contact, origin);
  }
}

export class UpdateContactService {
  public constructor(private readonly contacts: ContactRepository) {}

  public async execute(
    tenantId: string,
    id: string,
    input: { name?: unknown; email?: unknown; customFields?: unknown }
  ): Promise<ContactWithLabels> {
    const current = await this.contacts.findById(tenantId, id);
    if (!current) throw new NotFoundError("El contacto no existe.");

    let email = current.contact.email;
    if (input.email !== undefined) {
      email = input.email === null || input.email === "" ? null : normalizeEmail(String(input.email));
      if (input.email && email === null) throw new ValidationError("El correo no es válido.");
    }

    const next: Contact = {
      ...current.contact,
      ...(input.name !== undefined ? { name: typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 120) : null } : {}),
      email,
      ...(input.customFields !== undefined ? { customFields: requireCustomFields(input.customFields) } : {}),
      updatedAt: new Date().toISOString()
    };
    await this.contacts.update(next);
    return { contact: next, labels: current.labels };
  }
}

export class SetContactLabelsService {
  public constructor(
    private readonly contacts: ContactRepository,
    private readonly labels: LabelRepository
  ) {}

  /** Solo etiquetas del catálogo de ESTA cuenta; una ajena o inexistente es 404. */
  public async execute(tenantId: string, id: string, labelIds: ReadonlyArray<string>, origin?: LabelChangeOrigin): Promise<ContactWithLabels> {
    const unique = [...new Set(labelIds)];
    if (!(await this.contacts.findById(tenantId, id))) throw new NotFoundError("El contacto no existe.");
    for (const labelId of unique) {
      if (!(await this.labels.findById(tenantId, labelId))) throw new NotFoundError("Una de las etiquetas no existe.");
    }
    await this.contacts.setLabels(tenantId, id, unique, origin);
    return (await this.contacts.findById(tenantId, id))!;
  }
}
