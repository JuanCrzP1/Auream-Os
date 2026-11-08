import { beforeEach, describe, expect, it } from "vitest";
import { ContactDirectoryService } from "../../domains/contacts/application/ContactDirectoryService.js";
import { CreateContactService, ListContactsService, SetContactLabelsService, UpdateContactService } from "../../domains/contacts/application/ContactServices.js";
import { CreateLabelService, DeleteLabelService, ListLabelsService, UpdateLabelService } from "../../domains/contacts/application/LabelCatalogServices.js";
import { InMemoryContactRepository, InMemoryContactsStore, InMemoryLabelRepository } from "../../infrastructure/persistence/memory/InMemoryContactRepositories.js";
import { TagsNodeHandler } from "../../flow-engine/nodes/tags/TagsNodeHandler.js";
import type { FlowNode } from "../../contracts/FlowSnapshot.js";
import type { RuntimeInput, Session } from "../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// Contactos y etiquetas: reglas del dominio, casos de uso y el directorio que
// usa el motor (bloque Etiquetas).
// ---------------------------------------------------------------------------

const T = "tenant-a";
let contacts: InMemoryContactRepository;
let labels: InMemoryLabelRepository;

beforeEach(() => {
  const store = new InMemoryContactsStore();
  contacts = new InMemoryContactRepository(store);
  labels = new InMemoryLabelRepository(store);
});

describe("catálogo de etiquetas", () => {
  it("crea con nombre limpio y color; rechaza duplicados sin distinguir mayúsculas (409)", async () => {
    const create = new CreateLabelService(labels);
    const vip = await create.execute(T, { name: "  Cliente   VIP ", color: "#EF4444" });

    expect(vip).toMatchObject({ name: "Cliente VIP", color: "#ef4444" });
    await expect(create.execute(T, { name: "cliente vip" })).rejects.toMatchObject({ statusCode: 409 });
  });

  it.each([["sin nombre", { name: "  " }], ["nombre muy largo", { name: "x".repeat(41) }], ["color inválido", { name: "A", color: "rojo" }]])(
    "rechaza con 422: %s",
    async (_label, input) => {
      await expect(new CreateLabelService(labels).execute(T, input)).rejects.toMatchObject({ statusCode: 422 });
    }
  );

  it("renombra, recolorea y borra (y al borrar desaparece de los contactos)", async () => {
    const label = await new CreateLabelService(labels).execute(T, { name: "Lead" });
    const contact = await new CreateContactService(contacts).execute(T, { phone: "+57 300 111 2233" });
    await new SetContactLabelsService(contacts, labels).execute(T, contact.contact.id, [label.id]);

    expect((await new UpdateLabelService(labels).execute(T, label.id, { name: "Lead caliente", color: "#f97316" })).name).toBe("Lead caliente");
    expect((await new ListLabelsService(labels).execute(T))[0]?.contactCount).toBe(1);

    await new DeleteLabelService(labels).execute(T, label.id);
    expect((await contacts.findById(T, contact.contact.id))?.labels).toEqual([]);
  });

  it("las etiquetas son por cuenta: otra cuenta no las ve ni puede editarlas", async () => {
    const label = await new CreateLabelService(labels).execute(T, { name: "Privada" });
    expect(await new ListLabelsService(labels).execute("otra")).toEqual([]);
    await expect(new UpdateLabelService(labels).execute("otra", label.id, { name: "x" })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("contactos", () => {
  it("el teléfono se normaliza y no se duplica", async () => {
    const create = new CreateContactService(contacts);
    const first = await create.execute(T, { name: "Ana", phone: "+57 300-123-4567" });
    const again = await create.execute(T, { phone: "573001234567" });

    expect(first.contact.phone).toBe("573001234567");
    expect(again.contact.id).toBe(first.contact.id);
  });

  it("valida teléfono, correo y campos personalizados", async () => {
    await expect(new CreateContactService(contacts).execute(T, { phone: "123" })).rejects.toMatchObject({ statusCode: 422 });
    await expect(new CreateContactService(contacts).execute(T, { phone: "573001234567", email: "no-es-correo" })).rejects.toMatchObject({ statusCode: 422 });
    const { contact } = await new CreateContactService(contacts).execute(T, { phone: "573001234567" });
    await expect(new UpdateContactService(contacts).execute(T, contact.id, { customFields: { "mal nombre": "x" } })).rejects.toMatchObject({ statusCode: 422 });
    expect((await new UpdateContactService(contacts).execute(T, contact.id, { email: "ANA@Ejemplo.com", customFields: { ciudad: "Cali", edad: 30 } })).contact)
      .toMatchObject({ email: "ana@ejemplo.com", customFields: { ciudad: "Cali", edad: 30 } });
  });

  it("solo asigna etiquetas del catálogo de su cuenta", async () => {
    const foreign = await new CreateLabelService(labels).execute("otra", { name: "Ajena" });
    const { contact } = await new CreateContactService(contacts).execute(T, { phone: "573001234567" });
    await expect(new SetContactLabelsService(contacts, labels).execute(T, contact.id, [foreign.id])).rejects.toMatchObject({ statusCode: 404 });
  });

  it("busca por nombre, teléfono o correo y filtra por etiqueta", async () => {
    const vip = await new CreateLabelService(labels).execute(T, { name: "VIP" });
    const ana = await new CreateContactService(contacts).execute(T, { name: "Ana Pérez", phone: "573001111111" });
    await new CreateContactService(contacts).execute(T, { name: "Beto", phone: "573002222222" });
    await new SetContactLabelsService(contacts, labels).execute(T, ana.contact.id, [vip.id]);
    const list = new ListContactsService(contacts);

    expect((await list.execute(T, { search: "ana" })).items.map((i) => i.contact.name)).toEqual(["Ana Pérez"]);
    expect((await list.execute(T, { search: "2222" })).items.map((i) => i.contact.name)).toEqual(["Beto"]);
    expect((await list.execute(T, { labelId: vip.id })).items.map((i) => i.contact.name)).toEqual(["Ana Pérez"]);
  });
});

describe("directorio del motor (bloque Etiquetas)", () => {
  const directory = () => new ContactDirectoryService(contacts, labels);

  it("crea el contacto la primera vez que escribe y lo reconoce después", async () => {
    const first = await directory().resolve(T, { channel: "whatsapp", externalKey: "+57 300 999 8877" });
    const again = await directory().resolve(T, { channel: "whatsapp", externalKey: "573009998877" });
    expect(again.id).toBe(first.id);
    expect(first.phone).toBe("573009998877");
  });

  it("agrega por nombre (creando las que falten en el catálogo) y quita sin tocar las demás", async () => {
    await new CreateLabelService(labels).execute(T, { name: "VIP", color: "#ef4444" });
    const contact = await directory().resolve(T, { channel: "whatsapp", externalKey: "573001234567" });

    const added = await directory().addTags(T, contact.id, ["vip", "Nueva campaña", "VIP"]);
    expect([...added.tags].sort()).toEqual(["Nueva campaña", "VIP"]);
    expect((await new ListLabelsService(labels).execute(T)).map((l) => l.name)).toEqual(["Nueva campaña", "VIP"]);

    const removed = await directory().removeTags(T, contact.id, ["vip", "no-la-tiene"]);
    expect(removed.tags).toEqual(["Nueva campaña"]);
  });

  it("TagsNodeHandler aplica las etiquetas al contacto de la conversación", async () => {
    const node = { id: "tg", tenantId: T, flowVersionId: "v", type: "tags", name: "Etiquetas", content: {}, metadata: {}, config: { action: "add", tags: ["Lead", "Interesado"] } } as FlowNode;
    const input = { envelope: { tenantId: T, flowKey: "f", channel: "whatsapp", conversationKey: "c", userKey: "573001234567", messageId: "m", payload: { text: "hola" }, receivedAt: "2026-11-08T00:00:00Z" }, sessionContext: {}, isWaitingInput: false, now: "2026-11-08T00:00:00Z", timezone: "UTC" } as RuntimeInput;

    const result = await new TagsNodeHandler(directory()).execute(node, input, { tenantId: T } as Session);

    expect(result.executionStatus).toBe("success");
    expect([...(result.nodeResult.contactTags as string[])].sort()).toEqual(["Interesado", "Lead"]);
  });
});
