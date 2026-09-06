import { describe, it, expect, beforeEach } from "vitest";
import { MoveAutomationToFolderService } from "../../domains/automations/catalog/application/MoveAutomationToFolderService.js";
import type { AutomationRepository } from "../../domains/automations/catalog/application/AutomationRepository.js";
import type { FolderRepository } from "../../domains/automations/catalog/application/FolderRepository.js";
import type { AutomationFlow } from "../../domains/automations/catalog/domain/AutomationFlow.js";
import type { AutomationFolder } from "../../domains/automations/catalog/domain/AutomationFolder.js";

// ---------------------------------------------------------------------------
// MOVER UNA AUTOMATIZACIÓN A UNA CARPETA.
//
// La relación ya existía —`AutomationFlow.folderId`—; lo que faltaba era el
// caso de uso que la cambia. Aquí se fijan sus reglas, que son las que la
// interfaz no puede garantizar: que el destino exista, que sea del mismo
// tenant, y que soltar algo donde ya estaba no escriba nada.
// ---------------------------------------------------------------------------

class RepoFlujos implements AutomationRepository {
  escrituras: AutomationFlow[] = [];
  constructor(private items: AutomationFlow[] = []) {}
  async findByTenant(t: string) { return this.items.filter((f) => f.tenantId === t); }
  async findById(t: string, id: string) { return this.items.find((f) => f.tenantId === t && f.id === id); }
  async save(flow: AutomationFlow) {
    this.escrituras.push(flow);
    const i = this.items.findIndex((f) => f.tenantId === flow.tenantId && f.id === flow.id);
    if (i >= 0) this.items[i] = flow; else this.items.push(flow);
  }
  async delete(t: string, id: string) { this.items = this.items.filter((f) => !(f.tenantId === t && f.id === id)); }
}

class RepoCarpetas implements FolderRepository {
  constructor(private items: AutomationFolder[] = []) {}
  async findByTenant(t: string) { return this.items.filter((f) => f.tenantId === t); }
  async findById(t: string, id: string) { return this.items.find((f) => f.tenantId === t && f.id === id); }
  async save(folder: AutomationFolder) { this.items.push(folder); }
}

const TENANT = "tenant-1";
const OTRO = "tenant-2";

const flujo = (id: string, tenantId = TENANT, folderId?: string): AutomationFlow => ({
  id,
  tenantId,
  key: id,
  name: `Flujo ${id}`,
  status: "draft",
  ...(folderId !== undefined ? { folderId } : {}),
  metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }
});

const carpeta = (id: string, tenantId = TENANT): AutomationFolder =>
  ({ id, tenantId, name: `Carpeta ${id}` }) as AutomationFolder;

describe("mover una automatización a una carpeta", () => {
  let flujos: RepoFlujos;
  let carpetas: RepoCarpetas;
  let sut: MoveAutomationToFolderService;

  beforeEach(() => {
    flujos = new RepoFlujos([flujo("f1"), flujo("f2", TENANT, "c1"), flujo("ajeno", OTRO)]);
    carpetas = new RepoCarpetas([carpeta("c1"), carpeta("c2"), carpeta("c-ajena", OTRO)]);
    sut = new MoveAutomationToFolderService(flujos, carpetas);
  });

  it("un flujo suelto queda dentro de la carpeta", async () => {
    await sut.execute(TENANT, "f1", "c1");

    expect((await flujos.findById(TENANT, "f1"))?.folderId).toBe("c1");
  });

  it("un flujo pasa de una carpeta a otra", async () => {
    await sut.execute(TENANT, "f2", "c2");

    expect((await flujos.findById(TENANT, "f2"))?.folderId).toBe("c2");
  });

  it("`null` lo saca de la carpeta y lo devuelve a la raíz", async () => {
    await sut.execute(TENANT, "f2", null);

    const movido = await flujos.findById(TENANT, "f2");
    expect(movido?.folderId).toBeUndefined();
  });

  it("soltarlo donde ya estaba no escribe nada", async () => {
    await sut.execute(TENANT, "f2", "c1");

    expect(flujos.escrituras).toHaveLength(0);
  });

  it("un flujo ya en la raíz que se manda a la raíz tampoco escribe", async () => {
    await sut.execute(TENANT, "f1", null);

    expect(flujos.escrituras).toHaveLength(0);
  });

  it("mover actualiza la marca de tiempo, y solo eso", async () => {
    await sut.execute(TENANT, "f1", "c1");

    const [escrito] = flujos.escrituras;
    expect(escrito.name).toBe("Flujo f1");
    expect(escrito.status).toBe("draft");
    expect(escrito.metadata.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(escrito.metadata.updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
  });

  // -------------------------------------------------------------------------
  // AISLAMIENTO ENTRE TENANTS.
  //
  // Un identificador es adivinable. La comprobación no puede estar en la
  // interfaz: se hace aquí, buscando siempre con el tenant por delante.
  // -------------------------------------------------------------------------

  it("no se puede mover un flujo de otro tenant", async () => {
    await expect(sut.execute(TENANT, "ajeno", "c1")).rejects.toThrow();
    expect(flujos.escrituras).toHaveLength(0);
  });

  it("no se puede mover a una carpeta de otro tenant", async () => {
    await expect(sut.execute(TENANT, "f1", "c-ajena")).rejects.toThrow();
    expect(flujos.escrituras).toHaveLength(0);
  });

  it("una carpeta inexistente no deja el flujo apuntando al vacío", async () => {
    await expect(sut.execute(TENANT, "f1", "no-existe")).rejects.toThrow();
    expect((await flujos.findById(TENANT, "f1"))?.folderId).toBeUndefined();
  });

  it("un flujo inexistente falla sin tocar nada", async () => {
    await expect(sut.execute(TENANT, "no-existe", "c1")).rejects.toThrow();
    expect(flujos.escrituras).toHaveLength(0);
  });

  it("no recorre todos los flujos del tenant para mover uno", async () => {
    // Busca por id, no filtrando la lista entera. Importa cuando un tenant
    // tenga miles: `findByTenant` no debe entrar en esta operación.
    let recorridos = 0;
    const original = flujos.findByTenant.bind(flujos);
    flujos.findByTenant = async (t: string) => { recorridos += 1; return original(t); };

    await sut.execute(TENANT, "f1", "c1");

    expect(recorridos).toBe(0);
  });
});
