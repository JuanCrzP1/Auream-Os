import type { AdOrigin } from "../../../contracts/AdOrigin";
import type { Contact } from "../domain/Contact";
import type { ContactQuery, ContactRepository, ContactWithLabels } from "./ContactRepository";
import { ORIGIN_UNKNOWN, type ContactEvents, type ExclusiveLabelGroups, type LabelChangeOrigin } from "./LabelHooks";

// ---------------------------------------------------------------------------
// LabelRulesContactRepository — el único paso por donde cambian las etiquetas
// de un contacto (flujos, chat, ficha, CRM). Envuelve al repositorio real:
//
//   1. Aplica los grupos excluyentes: al poner una etiqueta, quita las otras
//      de su grupo (las etapas de un embudo). Si piden dos del mismo grupo a
//      la vez, gana la nueva (la que aún no tenía), y entre nuevas la última.
//   2. Avisa lo que de verdad cambió (`labelsChanged`) y los contactos nuevos
//      (`contactCreated`), con quién lo hizo.
//
// Un aviso que falla no deshace el cambio: las etiquetas mandan.
// ---------------------------------------------------------------------------

type LabelChange = { add: ReadonlyArray<string>; remove: ReadonlyArray<string> };

export class LabelRulesContactRepository implements ContactRepository {
  public constructor(
    private readonly inner: ContactRepository,
    private readonly groups: ExclusiveLabelGroups,
    private readonly events: ContactEvents,
    private readonly onError: (error: unknown) => void = () => {}
  ) {}

  public list(tenantId: string, query: ContactQuery) {
    return this.inner.list(tenantId, query);
  }

  public findById(tenantId: string, id: string) {
    return this.inner.findById(tenantId, id);
  }

  public findByIdentity(tenantId: string, channel: string, externalKey: string) {
    return this.inner.findByIdentity(tenantId, channel, externalKey);
  }

  public update(contact: Contact) {
    return this.inner.update(contact);
  }

  public setAdOrigin(tenantId: string, contactId: string, ad: AdOrigin) {
    return this.inner.setAdOrigin(tenantId, contactId, ad);
  }

  public async create(contact: Contact, origin: LabelChangeOrigin = ORIGIN_UNKNOWN): Promise<ContactWithLabels> {
    const stored = await this.inner.create(contact, origin);
    // Si otro lo creó a la vez, `create` devuelve el existente: ese no es nuevo.
    if (stored.contact.id === contact.id) await this.notify(() => this.events.contactCreated(contact.tenantId, contact.id, origin));
    return stored;
  }

  public async setLabels(tenantId: string, contactId: string, labelIds: ReadonlyArray<string>, origin: LabelChangeOrigin = ORIGIN_UNKNOWN): Promise<void> {
    const before = await this.current(tenantId, contactId);
    const wanted = [...new Set(labelIds)];
    const dropped = new Set<string>();
    for (const group of await this.groups.groupsOf(tenantId, wanted)) {
      const inGroup = wanted.filter((id) => group.includes(id));
      if (inGroup.length < 2) continue;
      const keep = pickWinner(inGroup, before);
      for (const id of inGroup) if (id !== keep) dropped.add(id);
    }
    const final = wanted.filter((id) => !dropped.has(id));
    await this.inner.setLabels(tenantId, contactId, final, origin);
    await this.publish(tenantId, contactId, before, new Set(final), origin);
  }

  public async changeLabels(tenantId: string, contactId: string, change: LabelChange, origin: LabelChangeOrigin = ORIGIN_UNKNOWN): Promise<void> {
    const before = await this.current(tenantId, contactId);
    const add = [...new Set(change.add)];
    const remove = new Set(change.remove.filter((id) => !add.includes(id)));
    const keepAdd = new Set(add);
    for (const group of await this.groups.groupsOf(tenantId, add)) {
      const inGroup = add.filter((id) => group.includes(id));
      const keep = pickWinner(inGroup, before);
      for (const id of inGroup) if (id !== keep) keepAdd.delete(id);
      for (const id of group) if (id !== keep && before.has(id)) remove.add(id);
    }
    const final = { add: [...keepAdd], remove: [...remove] };
    if (final.add.length === 0 && final.remove.length === 0) return;
    await this.inner.changeLabels(tenantId, contactId, final, origin);
    const after = new Set([...before].filter((id) => !remove.has(id)).concat(final.add));
    await this.publish(tenantId, contactId, before, after, origin);
  }

  private async current(tenantId: string, contactId: string): Promise<ReadonlySet<string>> {
    const found = await this.inner.findById(tenantId, contactId);
    return new Set(found?.labels.map((label) => label.id) ?? []);
  }

  private async publish(tenantId: string, contactId: string, before: ReadonlySet<string>, after: ReadonlySet<string>, origin: LabelChangeOrigin) {
    const added = [...after].filter((id) => !before.has(id));
    const removed = [...before].filter((id) => !after.has(id));
    if (added.length === 0 && removed.length === 0) return;
    await this.notify(() => this.events.labelsChanged(tenantId, contactId, { added, removed }, origin));
  }

  private async notify(send: () => Promise<void>): Promise<void> {
    try {
      await send();
    } catch (error) {
      this.onError(error);
    }
  }
}

/** De varias etiquetas del mismo grupo, la que se queda: la última que aún no tenía (o la última). */
function pickWinner(ids: ReadonlyArray<string>, before: ReadonlySet<string>): string {
  const fresh = ids.filter((id) => !before.has(id));
  return (fresh.length > 0 ? fresh : ids)[(fresh.length > 0 ? fresh : ids).length - 1]!;
}
