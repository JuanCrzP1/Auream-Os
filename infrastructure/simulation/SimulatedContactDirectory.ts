import type { ContactFieldValue, ContactIdentity, ContactProfile } from "../../contracts/ContactContracts";
import type { SimulationPersona } from "../../contracts/SimulationContracts";
import type { ContactDirectory } from "../../flow-engine/ports/ContactDirectory";
import type { SimulationJournal } from "../../domains/automations/simulation/domain/SimulationJournal";

/**
 * El contacto de una prueba: el CLIENTE DE PRUEBA, nunca uno real. Las
 * etiquetas y campos que pongan los bloques quedan en él (y se anotan en el
 * recorrido); al terminar el turno vuelve al navegador con los cambios.
 */
export class SimulatedContactDirectory implements ContactDirectory {
  private persona: SimulationPersona;

  public constructor(
    persona: SimulationPersona,
    private readonly journal: SimulationJournal
  ) {
    this.persona = persona;
  }

  public current(): SimulationPersona {
    return this.persona;
  }

  public async resolve(_tenantId: string, _identity: ContactIdentity): Promise<ContactProfile> {
    return this.profile();
  }

  public async addTags(_tenantId: string, _contactId: string, names: ReadonlyArray<string>): Promise<ContactProfile> {
    const added = names.map((name) => name.trim()).filter((name) => name && !this.persona.tags.some((tag) => tag.toLowerCase() === name.toLowerCase()));
    if (added.length) this.persona = { ...this.persona, tags: [...this.persona.tags, ...added] };
    if (names.length) this.journal.note(`Etiquetas añadidas: ${names.join(", ")}`);
    return this.profile();
  }

  public async removeTags(_tenantId: string, _contactId: string, names: ReadonlyArray<string>): Promise<ContactProfile> {
    const removed = new Set(names.map((name) => name.trim().toLowerCase()));
    this.persona = { ...this.persona, tags: this.persona.tags.filter((tag) => !removed.has(tag.toLowerCase())) };
    if (names.length) this.journal.note(`Etiquetas quitadas: ${names.join(", ")}`);
    return this.profile();
  }

  public async setFields(_tenantId: string, _contactId: string, fields: Readonly<Record<string, unknown>>): Promise<ContactProfile> {
    const next: Record<string, ContactFieldValue> = { ...this.persona.fields };
    for (const [key, value] of Object.entries(fields)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") next[key] = value;
    }
    this.persona = { ...this.persona, fields: next };
    if (Object.keys(fields).length) this.journal.note(`Campos del contacto: ${Object.keys(fields).join(", ")}`);
    return this.profile();
  }

  private profile(): ContactProfile {
    const { name, phone, email, tags, fields } = this.persona;
    return { id: "cliente-de-prueba", name, phone, email: email || null, tags, fields };
  }
}
