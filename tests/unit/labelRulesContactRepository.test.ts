import { describe, expect, it, vi } from "vitest";
import type { ContactRepository, ContactWithLabels } from "../../domains/contacts/application/ContactRepository.js";
import { LabelRulesContactRepository } from "../../domains/contacts/application/LabelRulesContactRepository.js";
import type { ContactEvents } from "../../domains/contacts/application/LabelHooks.js";
import type { Contact } from "../../domains/contacts/domain/Contact.js";

// ---------------------------------------------------------------------------
// Todo cambio de etiquetas pasa por aquí: una etiqueta de un grupo excluyente
// (las etapas de un embudo) quita las otras del grupo, y se avisa SOLO lo que
// de verdad cambió, con quién lo hizo. Un aviso que falla no deshace nada.
// ---------------------------------------------------------------------------

const T = "tenant-a";
const C = "contact-1";
const STAGES = ["nuevo", "interesado", "pago"];

function fakeInner(initial: string[]) {
  const held = new Set(initial);
  const contact = { id: C, tenantId: T } as Contact;
  const view = (): ContactWithLabels => ({ contact, labels: [...held].map((id) => ({ id, tenantId: T, name: id, color: "#000000", createdAt: "" })) });
  const inner = {
    findById: vi.fn(async () => view()),
    changeLabels: vi.fn(async (_t: string, _c: string, change: { add: ReadonlyArray<string>; remove: ReadonlyArray<string> }) => {
      for (const id of change.remove) held.delete(id);
      for (const id of change.add) held.add(id);
    }),
    setLabels: vi.fn(async (_t: string, _c: string, ids: ReadonlyArray<string>) => {
      held.clear();
      for (const id of ids) held.add(id);
    }),
    create: vi.fn(async (created: Contact) => ({ contact: created, labels: [] }))
  };
  return { inner: inner as unknown as ContactRepository & typeof inner, held };
}

function build(initial: string[], events: Partial<ContactEvents> = {}) {
  const { inner, held } = fakeInner(initial);
  const labelsChanged = vi.fn(events.labelsChanged ?? (async () => {}));
  const contactCreated = vi.fn(events.contactCreated ?? (async () => {}));
  const onError = vi.fn();
  const groups = { groupsOf: async (_t: string, ids: ReadonlyArray<string>) => (ids.some((id) => STAGES.includes(id)) ? [STAGES] : []) };
  const repo = new LabelRulesContactRepository(inner, groups, { labelsChanged, contactCreated }, onError);
  return { repo, inner, held, labelsChanged, contactCreated, onError };
}

describe("LabelRulesContactRepository", () => {
  it("poner una etapa quita la anterior del mismo embudo y avisa el cambio con su origen", async () => {
    const { repo, held, labelsChanged } = build(["nuevo", "vip"]);
    await repo.changeLabels(T, C, { add: ["interesado"], remove: [] }, { kind: "flow", flowKey: "bienvenida" });
    expect([...held].sort()).toEqual(["interesado", "vip"]);
    expect(labelsChanged).toHaveBeenCalledWith(T, C, { added: ["interesado"], removed: ["nuevo"] }, { kind: "flow", flowKey: "bienvenida" });
  });

  it("etiquetas que no son etapas no se tocan entre sí", async () => {
    const { repo, held } = build(["vip"]);
    await repo.changeLabels(T, C, { add: ["cumpleaños"], remove: [] });
    expect([...held].sort()).toEqual(["cumpleaños", "vip"]);
  });

  it("si piden dos etapas del mismo embudo a la vez, gana la última nueva", async () => {
    const { repo, held } = build(["nuevo"]);
    await repo.changeLabels(T, C, { add: ["interesado", "pago"], remove: [] });
    expect([...held]).toEqual(["pago"]);
  });

  it("reemplazar todas (la ficha o el chat) con dos etapas deja la que no tenía", async () => {
    const { repo, held, labelsChanged } = build(["nuevo", "vip"]);
    await repo.setLabels(T, C, ["nuevo", "pago", "vip"], { kind: "user", userId: "u1" });
    expect([...held].sort()).toEqual(["pago", "vip"]);
    expect(labelsChanged).toHaveBeenCalledWith(T, C, { added: ["pago"], removed: ["nuevo"] }, { kind: "user", userId: "u1" });
  });

  it("sin cambios reales no escribe ni avisa", async () => {
    const { repo, inner, labelsChanged } = build(["nuevo"]);
    await repo.changeLabels(T, C, { add: [], remove: [] });
    expect(inner.changeLabels).not.toHaveBeenCalled();
    await repo.changeLabels(T, C, { add: ["nuevo"], remove: [] });
    expect(labelsChanged).not.toHaveBeenCalled();
  });

  it("un aviso que falla no deshace el cambio", async () => {
    const { repo, held, onError } = build(["nuevo"], { labelsChanged: async () => { throw new Error("crm caído"); } });
    await repo.changeLabels(T, C, { add: ["pago"], remove: [] });
    expect([...held]).toEqual(["pago"]);
    expect(onError).toHaveBeenCalled();
  });

  it("avisa un contacto nuevo solo si de verdad se creó (no si ya existía)", async () => {
    const { repo, inner, contactCreated } = build([]);
    const contact = { id: "nuevo-id", tenantId: T } as Contact;
    await repo.create(contact, { kind: "flow" });
    expect(contactCreated).toHaveBeenCalledWith(T, "nuevo-id", { kind: "flow" });
    inner.create.mockResolvedValueOnce({ contact: { ...contact, id: "otro" }, labels: [] });
    await repo.create(contact);
    expect(contactCreated).toHaveBeenCalledTimes(1);
  });
});
