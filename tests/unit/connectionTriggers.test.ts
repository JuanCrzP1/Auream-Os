import { describe, expect, it } from "vitest";
import { keywordMatches, normalizeTriggerText, selectTrigger, type ConnectionTrigger } from "../../contracts/ConnectionTriggerContracts.js";
import { ConnectionTriggerServices } from "../../domains/connections/application/ConnectionTriggerServices.js";
import { CreateConnectionService } from "../../domains/connections/application/ConnectionServices.js";
import { InMemoryConnectionRepository } from "../../infrastructure/persistence/memory/InMemoryConnectionRepository.js";
import { InMemoryConnectionTriggerRepository, InMemoryFlowCatalog } from "../../infrastructure/persistence/memory/InMemoryConnectionTriggerRepository.js";
import { ConflictError } from "../../platform/observability/errors/ConflictError.js";
import { NotFoundError } from "../../platform/observability/errors/NotFoundError.js";
import { ValidationError } from "../../platform/observability/errors/ValidationError.js";

// ---------------------------------------------------------------------------
// Disparadores por conexión: qué flujo arranca cada mensaje (gana el más
// específico), palabras clave como las escribe la gente, y las reglas: flujo
// de la cuenta y no archivado, una palabra por flujo, un genérico de cada tipo.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const VENTAS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SOPORTE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ARCHIVADO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("palabras clave", () => {
  it("compara sin tildes, mayúsculas ni signos", () => {
    expect(normalizeTriggerText("¡Hola!  ¿Cuál es el PRECIO?")).toBe("hola cual es el precio");
    expect(keywordMatches("¿Cuál es el precio?", "precio", "contains")).toBe(true);
    expect(keywordMatches("Quiero información", "informacion", "contains")).toBe(true);
  });

  it("«contiene» busca la palabra completa, no un pedazo", () => {
    expect(keywordMatches("hola", "hola", "contains")).toBe(true);
    expect(keywordMatches("viajo a holanda", "hola", "contains")).toBe(false);
    expect(keywordMatches("quiero ver el plan pro hoy", "plan pro", "contains")).toBe(true);
  });

  it("«exacta» y «empieza por»", () => {
    expect(keywordMatches("Menú", "menu", "exact")).toBe(true);
    expect(keywordMatches("menu por favor", "menu", "exact")).toBe(false);
    expect(keywordMatches("Menú por favor", "menu", "starts_with")).toBe(true);
    expect(keywordMatches("ver menu", "menu", "starts_with")).toBe(false);
  });
});

describe("selectTrigger", () => {
  const t = (over: Partial<ConnectionTrigger>): ConnectionTrigger => ({
    id: "x", connectionId: "c", type: "any_message", keywords: [], match: "contains", automationId: "f", automationName: "F", enabled: true, createdAt: "2026-11-09T00:00:00.000Z", updatedAt: "", ...over
  });
  const triggers = [
    t({ id: "cualquiera", type: "any_message" }),
    t({ id: "nuevo", type: "first_message" }),
    t({ id: "anuncio", type: "ad_click" }),
    t({ id: "precio", type: "keyword", keywords: ["precio", "cuánto cuesta"] }),
    t({ id: "pausado", type: "keyword", keywords: ["hola"], enabled: false })
  ];

  it("gana el más específico: palabra clave > anuncio > primer mensaje > cualquier mensaje", () => {
    expect(selectTrigger(triggers, { text: "¿precio?", isNewContact: true, fromAd: true })?.id).toBe("precio");
    expect(selectTrigger(triggers, { text: "buenas", isNewContact: true, fromAd: true })?.id).toBe("anuncio");
    expect(selectTrigger(triggers, { text: "buenas", isNewContact: true, fromAd: false })?.id).toBe("nuevo");
    expect(selectTrigger(triggers, { text: "buenas", isNewContact: false, fromAd: false })?.id).toBe("cualquiera");
  });

  it("los pausados no cuentan; sin coincidencias, nada", () => {
    expect(selectTrigger(triggers, { text: "hola", isNewContact: false, fromAd: false })?.id).toBe("cualquiera");
    expect(selectTrigger(triggers.filter((x) => x.type === "keyword"), { text: "hola", isNewContact: false, fromAd: false })).toBeNull();
  });
});

async function setup() {
  const connections = new InMemoryConnectionRepository();
  const flows = new InMemoryFlowCatalog([
    { tenantId: T, id: VENTAS, name: "Ventas", archived: false },
    { tenantId: T, id: SOPORTE, name: "Soporte", archived: false },
    { tenantId: T, id: ARCHIVADO, name: "Viejo", archived: true }
  ]);
  const services = new ConnectionTriggerServices(connections, new InMemoryConnectionTriggerRepository(), flows);
  const connection = await new CreateConnectionService(connections).execute(T, { name: "Ventas CO", method: "qr" });
  return { services, id: connection.id };
}

describe("ConnectionTriggerServices", () => {
  it("crea, lista con el nombre del flujo, pausa y quita", async () => {
    const { services, id } = await setup();
    const created = await services.create(T, id, { type: "keyword", keywords: [" Precio ", "precio", "cuánto cuesta"], automationId: VENTAS });
    expect(created).toMatchObject({ keywords: ["Precio", "cuánto cuesta"], match: "contains", automationName: "Ventas", enabled: true });

    expect((await services.update(T, id, created.id, { enabled: false })).enabled).toBe(false);
    expect(await services.list(T, id)).toHaveLength(1);
    await services.remove(T, id, created.id);
    expect(await services.list(T, id)).toEqual([]);
  });

  it("valida el flujo (de la cuenta y sin archivar) y las palabras clave", async () => {
    const { services, id } = await setup();
    await expect(services.create(T, id, { type: "any_message", automationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" })).rejects.toThrow(/no existe/);
    await expect(services.create(T, id, { type: "any_message", automationId: ARCHIVADO })).rejects.toThrow(/archivado/);
    await expect(services.create(T, id, { type: "keyword", keywords: [], automationId: VENTAS })).rejects.toThrow(ValidationError);
    await expect(services.create(T, id, { type: "keyword", keywords: ["x".repeat(61)], automationId: VENTAS })).rejects.toThrow(ValidationError);
  });

  it("una palabra clave dispara un solo flujo por número", async () => {
    const { services, id } = await setup();
    await services.create(T, id, { type: "keyword", keywords: ["precio"], automationId: VENTAS });
    await expect(services.create(T, id, { type: "keyword", keywords: ["soporte", "PRECIO"], automationId: SOPORTE })).rejects.toThrow(/«PRECIO» ya dispara otro flujo/);
  });

  it("un solo «cualquier mensaje» (y anuncio, primer mensaje) por número", async () => {
    const { services, id } = await setup();
    await services.create(T, id, { type: "any_message", automationId: VENTAS });
    await expect(services.create(T, id, { type: "any_message", automationId: SOPORTE })).rejects.toThrow(ConflictError);
  });

  it("resuelve el flujo de un mensaje entrante e ignora los archivados", async () => {
    const { services, id } = await setup();
    await services.create(T, id, { type: "keyword", keywords: ["soporte"], automationId: SOPORTE });
    await services.create(T, id, { type: "any_message", automationId: VENTAS });
    expect(await services.resolve(T, id, { text: "Necesito soporte", isNewContact: false, fromAd: false })).toMatchObject({ automationId: SOPORTE });
    expect(await services.resolve(T, id, { text: "hola", isNewContact: false, fromAd: false })).toMatchObject({ automationId: VENTAS });
  });

  it("otra cuenta no ve ni toca los disparadores", async () => {
    const { services, id } = await setup();
    const created = await services.create(T, id, { type: "any_message", automationId: VENTAS });
    await expect(services.list(OTHER, id)).rejects.toThrow(NotFoundError);
    await expect(services.remove(OTHER, id, created.id)).rejects.toThrow(NotFoundError);
  });
});
