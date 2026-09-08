import { describe, it, expect, beforeEach } from "vitest";
import { GetBuilderWorkspaceService } from "../../domains/automations/builder/application/GetBuilderWorkspaceService.js";
import { SaveDraftService } from "../../domains/automations/builder/application/SaveDraftService.js";
import type { BuilderWorkspaceRepository } from "../../domains/automations/builder/application/BuilderWorkspaceRepository.js";
import type { AutomationRepository } from "../../domains/automations/catalog/application/AutomationRepository.js";
import type { PersistedBuilderWorkspace } from "../../contracts/BuilderContracts.js";
import type { AutomationFlow } from "../../domains/automations/catalog/domain/AutomationFlow.js";

// ---------------------------------------------------------------------------
// EL NOMBRE DE UN FLUJO SE GUARDA EN UN SOLO SITIO.
//
// El hub lee `AutomationFlow.name`; el editor edita `draft.flow.name`. Eran dos
// hechos persistidos por separado y nada los reconciliaba después de crear el
// flujo: renombrar en el editor dejaba la tarjeta del hub con el nombre viejo
// para siempre, y renombrar en el hub dejaba el editor con el suyo.
//
// Comprobado en disco antes de la corrección: el mismo id con
// «Bienvenida a clientes 72636» en el workspace y «Nueva automatización» en el
// catálogo.
//
// La verdad es el FLUJO del catálogo. El borrador la proyecta al leer y la
// escribe al guardar.
// ---------------------------------------------------------------------------

class RepoWorkspaces implements BuilderWorkspaceRepository {
  private items = new Map<string, PersistedBuilderWorkspace>();
  async getWorkspace(tenantId: string, flowKey: string) {
    return this.items.get(`${tenantId}:${flowKey}`) ?? null;
  }
  async getWorkspaces(tenantId: string, flowKeys: readonly string[]) {
    const workspaces = await Promise.all(flowKeys.map((flowKey) => this.getWorkspace(tenantId, flowKey)));
    return workspaces.filter((workspace): workspace is PersistedBuilderWorkspace => workspace !== null);
  }
  async saveWorkspace(ws: PersistedBuilderWorkspace) {
    this.items.set(`${ws.tenantId}:${ws.flowKey}`, ws);
  }
  async deleteWorkspace(tenantId: string, flowKey: string) {
    this.items.delete(`${tenantId}:${flowKey}`);
  }
  /** Lo que quedó guardado, sin proyecciones de lectura. */
  crudo(tenantId: string, flowKey: string) {
    return this.items.get(`${tenantId}:${flowKey}`);
  }
}

class RepoCatalogo implements AutomationRepository {
  private items: AutomationFlow[] = [];
  escrituras = 0;
  async findByTenant(tenantId: string) {
    return this.items.filter((f) => f.tenantId === tenantId);
  }
  async findById(tenantId: string, id: string) {
    return this.items.find((f) => f.tenantId === tenantId && f.id === id);
  }
  async save(flow: AutomationFlow) {
    this.escrituras += 1;
    const i = this.items.findIndex((f) => f.tenantId === flow.tenantId && f.id === flow.id);
    if (i >= 0) this.items[i] = flow;
    else this.items.push(flow);
  }
  async delete(tenantId: string, id: string) {
    this.items = this.items.filter((f) => !(f.tenantId === tenantId && f.id === id));
  }
}

const TENANT = "tenant-1";
const CLAVE = "flujo-a";

const nuevoWorkspace = (tenantId: string, flowKey: string): PersistedBuilderWorkspace => ({
  tenantId,
  flowKey,
  draft: {
    flow: { id: flowKey, key: flowKey, name: "Nueva automatización" },
    version: { id: `${flowKey}:v1:draft`, versionNumber: 1, status: "draft", entryNodeId: "start_message" },
    nodes: {},
    edgesBySource: {}
  },
  publishedSnapshots: [],
  updatedAt: new Date().toISOString(),
  autosaveRevision: 0
});

/** El borrador tal y como lo manda el editor tras renombrar. */
const conNombre = (ws: PersistedBuilderWorkspace, name: string) => ({
  ...ws.draft,
  flow: { ...ws.draft.flow, name }
});

describe("el nombre del flujo tiene una sola fuente de verdad", () => {
  let workspaces: RepoWorkspaces;
  let catalogo: RepoCatalogo;
  let leer: GetBuilderWorkspaceService;
  let guardar: SaveDraftService;

  beforeEach(async () => {
    workspaces = new RepoWorkspaces();
    catalogo = new RepoCatalogo();
    leer = new GetBuilderWorkspaceService(workspaces, nuevoWorkspace, catalogo);
    guardar = new SaveDraftService(workspaces, catalogo);
    // Primera entrada al editor: crea el workspace y su entrada en el catálogo.
    await leer.execute(TENANT, CLAVE);
    catalogo.escrituras = 0;
  });

  it("al crear el flujo, hub y editor arrancan con el mismo nombre", async () => {
    const ws = await leer.execute(TENANT, CLAVE);
    const flow = await catalogo.findById(TENANT, CLAVE);

    expect(ws.draft.flow.name).toBe("Nueva automatización");
    expect(flow?.name).toBe("Nueva automatización");
  });

  it("RENOMBRAR EN EL EDITOR llega al catálogo que lee el hub", async () => {
    const ws = await leer.execute(TENANT, CLAVE);

    await guardar.execute(ws, conNombre(ws, "Bienvenida a clientes"));

    const flow = await catalogo.findById(TENANT, CLAVE);
    expect(flow?.name).toBe("Bienvenida a clientes");
  });

  it("y sigue ahí al volver a abrir el editor", async () => {
    const ws = await leer.execute(TENANT, CLAVE);
    await guardar.execute(ws, conNombre(ws, "Bienvenida a clientes"));

    const reabierto = await leer.execute(TENANT, CLAVE);
    expect(reabierto.draft.flow.name).toBe("Bienvenida a clientes");
  });

  it("RENOMBRAR EN EL HUB se ve al abrir el editor", async () => {
    // Es el defecto espejo: antes el editor servía su copia envejecida.
    const flow = (await catalogo.findById(TENANT, CLAVE))!;
    await catalogo.save({ ...flow, name: "Renombrado desde el hub" });

    const ws = await leer.execute(TENANT, CLAVE);
    expect(ws.draft.flow.name).toBe("Renombrado desde el hub");
  });

  it("el catálogo manda aunque el workspace guardado tenga otra cosa", async () => {
    const ws = await leer.execute(TENANT, CLAVE);
    await guardar.execute(ws, conNombre(ws, "Nombre del editor"));

    const flow = (await catalogo.findById(TENANT, CLAVE))!;
    await catalogo.save({ ...flow, name: "Nombre del hub" });

    const servido = await leer.execute(TENANT, CLAVE);
    expect(servido.draft.flow.name).toBe("Nombre del hub");
    // El workspace en disco conserva su copia; deja de ser la que manda.
    expect(workspaces.crudo(TENANT, CLAVE)?.draft.flow.name).toBe("Nombre del editor");
  });

  it("guardar sin tocar el nombre no reescribe la entrada del hub", async () => {
    // El autoguardado corre con cada gesto del lienzo. Ninguno toca el nombre.
    const ws = await leer.execute(TENANT, CLAVE);

    await guardar.execute(ws, ws.draft);
    await guardar.execute(ws, ws.draft);

    expect(catalogo.escrituras).toBe(0);
  });

  it("un flujo sin entrada en el catálogo no se inventa al guardar", async () => {
    const huerfano = nuevoWorkspace(TENANT, "sin-catalogo");

    await guardar.execute(huerfano, conNombre(huerfano, "Da igual"));

    expect(await catalogo.findById(TENANT, "sin-catalogo")).toBeUndefined();
  });
});
