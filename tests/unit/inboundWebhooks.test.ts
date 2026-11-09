import { describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { normalizePhone, readPath, readText, requireWebhookMapping } from "../../domains/webhooks/domain/InboundWebhook.js";
import { WebhookAdminServices } from "../../domains/webhooks/application/WebhookAdminServices.js";
import { ReceiveWebhookService } from "../../domains/webhooks/application/ReceiveWebhookService.js";
import type { WebhookConnections, WebhookContacts, WebhookFlows } from "../../domains/webhooks/application/ports.js";
import { InMemoryWebhookRepository } from "../../infrastructure/persistence/memory/InMemoryWebhookRepository.js";
import { AesGcmSecretCipher } from "../../platform/security/secrets/AesGcmSecretCipher.js";
import { EMPTY_WEBHOOK_MAPPING, type WebhookMapping } from "../../contracts/WebhookContracts.js";

// ---------------------------------------------------------------------------
// Webhooks de entrada (como en Leona): dirección secreta, mapeo del envío al
// contacto, etiquetas e inicio de flujo, con su historial. A diferencia de
// Leona, los datos y etiquetas no necesitan número, y el teléfono se compara
// completo (con su prefijo), no por los últimos 8 dígitos.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const CONNECTION = "22222222-2222-4222-8222-222222222222";
const BUYER = { data: { buyer: { name: "Laura Gómez", phone: "+58 412-555 0117", email: "LAURA@correo.com", city: "Caracas" }, items: [{ product: "Canción" }] } };

function setup(options: { readonly connected?: boolean } = {}) {
  const repository = new InMemoryWebhookRepository();
  const cipher = new AesGcmSecretCipher({ current: "v1", keys: { v1: randomBytes(32) } });
  const contacts = {
    identify: vi.fn(async () => ({ contactId: "contact-1" })),
    update: vi.fn(async () => undefined),
    addTags: vi.fn(async () => undefined),
    removeTags: vi.fn(async () => undefined)
  } satisfies WebhookContacts;
  const connections: WebhookConnections = { find: async (_t, id) => (id === CONNECTION ? { name: "Ventas", connected: options.connected ?? true } : null) };
  const flows = { launch: vi.fn(async () => ({ flowName: "Reconstruye tu vida" })) } satisfies WebhookFlows;
  let ids = 0;
  const admin = new WebhookAdminServices({ repository, connections, cipher, publicBaseUrl: "https://auream-os.vercel.app/api", newId: () => `00000000-0000-4000-8000-00000000000${++ids}`, newSecret: () => "secreto-largo-de-prueba" });
  const receive = new ReceiveWebhookService({ repository, cipher, contacts, connections, flows, now: () => new Date("2026-11-09T19:00:00.000Z") });
  return { repository, admin, receive, contacts, flows };
}

const mapping = (over: Partial<WebhookMapping> = {}): WebhookMapping => ({
  ...EMPTY_WEBHOOK_MAPPING,
  phonePath: "data.buyer.phone",
  namePath: "data.buyer.name",
  emailPath: "data.buyer.email",
  defaultCountryCode: "58",
  fields: [{ key: "ciudad", path: "data.buyer.city" }, { key: "producto", path: "data.items.0.product" }],
  ...over
});

describe("reglas del webhook", () => {
  it("lee datos por su ruta, también dentro de listas", () => {
    expect(readPath(BUYER, "data.items.0.product")).toBe("Canción");
    expect(readText(BUYER, "data.buyer.missing")).toBeNull();
    expect(readText({ total: 125.5, paid: true }, "total")).toBe("125.5");
  });

  it("normaliza el teléfono completo: internacional, con 00, local con 0 de larga distancia o sin prefijo", () => {
    expect(normalizePhone("+58 412-555 0117", "57")).toBe("584125550117");
    expect(normalizePhone("0058 412 555 0117", "57")).toBe("584125550117");
    expect(normalizePhone("0412 555 0117", "58")).toBe("584125550117");
    expect(normalizePhone("300 123 4567", "57")).toBe("573001234567");
    expect(normalizePhone("123", "57")).toBeNull();
  });

  it("rechaza campos con nombre inválido o repetido y un campo sin ruta", () => {
    expect(() => requireWebhookMapping(mapping({ fields: [{ key: "mal nombre", path: "x" }] }))).toThrow(/no es un nombre de campo válido/);
    expect(() => requireWebhookMapping(mapping({ fields: [{ key: "a", path: "x" }, { key: "a", path: "y" }] }))).toThrow(/repetidos/);
    expect(() => requireWebhookMapping(mapping({ fields: [{ key: "a", path: "" }] }))).toThrow(/Elige de dónde sale/);
  });
});

describe("administrar webhooks", () => {
  it("crea con dirección secreta (guardada cifrada), edita el mapeo y exige número para iniciar flujos", async () => {
    const { admin, repository } = setup();
    const created = await admin.create(T, { name: "Hotmart ventas" });
    expect(created.url).toBe("https://auream-os.vercel.app/api/hooks/in/00000000-0000-4000-8000-000000000001/secreto-largo-de-prueba");
    expect(repository.webhooks.get(created.id)!.secretEnvelope).not.toContain("secreto-largo");

    await expect(admin.update(T, created.id, { mapping: mapping({ flowId: "flow-1" }) })).rejects.toThrow(/elige el número de WhatsApp/);
    const updated = await admin.update(T, created.id, { connectionId: CONNECTION, mapping: mapping({ flowId: "flow-1" }) });
    expect(updated).toMatchObject({ connectionId: CONNECTION, mapping: { flowId: "flow-1", phonePath: "data.buyer.phone" } });
    await expect(admin.create(T, { name: "x", connectionId: "33333333-3333-4333-8333-333333333333" })).rejects.toThrow(/no existe/);
    await expect(admin.get("otra-cuenta", created.id)).rejects.toThrow(/no existe/);
  });
});

describe("recibir un envío", () => {
  async function webhookWith(over: Partial<WebhookMapping>, options: { readonly connected?: boolean; readonly connection?: boolean; readonly enabled?: boolean } = {}) {
    const s = setup(options);
    const created = await s.admin.create(T, { name: "Ventas", ...(options.connection === false ? {} : { connectionId: CONNECTION }) });
    await s.admin.update(T, created.id, { mapping: mapping(over), ...(options.enabled === false ? { enabled: false } : {}) });
    const webhook = (await s.receive.authenticate(created.id, "secreto-largo-de-prueba"))!;
    return { ...s, webhook, id: created.id };
  }

  it("solo con la dirección y el secreto correctos", async () => {
    const { receive, id } = await webhookWith({});
    expect(await receive.authenticate(id, "otro")).toBeNull();
    expect(await receive.authenticate("44444444-4444-4444-8444-444444444444", "secreto-largo-de-prueba")).toBeNull();
  });

  it("identifica al cliente, guarda nombre, correo y campos, aplica etiquetas, inicia el flujo y lo anota", async () => {
    const { receive, webhook, contacts, flows, admin, id } = await webhookWith({ addTags: ["Compró"], removeTags: ["Interesado"], flowId: "flow-1" });
    expect(await receive.process(webhook, BUYER)).toBe("processed");
    expect(contacts.identify).toHaveBeenCalledWith(T, "584125550117", "Laura Gómez");
    expect(contacts.update).toHaveBeenCalledWith(T, "contact-1", { fields: { ciudad: "Caracas", producto: "Canción" }, email: "laura@correo.com" });
    expect(contacts.addTags).toHaveBeenCalledWith(T, "contact-1", ["Compró"]);
    expect(flows.launch).toHaveBeenCalledWith(T, { connectionId: CONNECTION, phone: "584125550117", contactId: "contact-1" }, "flow-1");
    const [delivery] = await admin.history(T, id);
    expect(delivery).toMatchObject({ outcome: "processed", phone: "584125550117", flowStarted: true, error: null });
    expect(delivery!.notes).toContain("Flujo iniciado: «Reconstruye tu vida».");
    expect((await admin.get(T, id)).sample).toEqual(BUYER);
  });

  it("sin teléfono mapeado solo guarda el ejemplo; sin teléfono válido falla con el motivo; desactivado, se ignora", async () => {
    const sample = await webhookWith({ phonePath: "" });
    expect(await sample.receive.process(sample.webhook, BUYER)).toBe("sample");
    expect(sample.contacts.identify).not.toHaveBeenCalled();

    const invalid = await webhookWith({ phonePath: "data.buyer.city" });
    expect(await invalid.receive.process(invalid.webhook, BUYER)).toBe("failed");
    expect((await invalid.admin.history(T, invalid.id))[0]!.error).toBe("No llegó un teléfono válido en «data.buyer.city».");

    const off = await webhookWith({}, { enabled: false });
    expect(await off.receive.process(off.webhook, BUYER)).toBe("ignored");
  });

  it("con el número desconectado no inicia el flujo pero sí guarda contacto y etiquetas, y explica por qué", async () => {
    const { receive, webhook, contacts, flows, admin, id } = await webhookWith({ addTags: ["Compró"], flowId: "flow-1" }, { connected: false });
    expect(await receive.process(webhook, BUYER)).toBe("processed");
    expect(contacts.addTags).toHaveBeenCalled();
    expect(flows.launch).not.toHaveBeenCalled();
    expect((await admin.history(T, id))[0]).toMatchObject({ flowStarted: false, error: "No se inició el flujo: el número «Ventas» está desconectado." });
  });

  it("anota los datos que faltaron y un correo inválido, sin fallar", async () => {
    const { receive, webhook, admin, id } = await webhookWith({ emailPath: "data.buyer.city", fields: [{ key: "pais", path: "data.buyer.country" }] });
    await receive.process(webhook, BUYER);
    expect((await admin.history(T, id))[0]!.notes).toEqual(["Sin dato para «pais» en «data.buyer.country».", "El correo «Caracas» no es válido: no se guardó."]);
  });
});
