import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlAutomationRepository } from "../../infrastructure/persistence/sql/SqlAutomationRepository.js";
import { SqlFolderRepository } from "../../infrastructure/persistence/sql/SqlFolderRepository.js";
import { SqlBuilderWorkspaceRepository } from "../../infrastructure/persistence/sql/SqlBuilderWorkspaceRepository.js";
import { SqlAutomationsUnitOfWork } from "../../infrastructure/persistence/sql/SqlAutomationsUnitOfWork.js";
import { UpgradingBuilderWorkspaceRepository } from "../../domains/automations/builder/application/UpgradingBuilderWorkspaceRepository.js";
import { CreateAutomationService } from "../../domains/automations/builder/application/CreateAutomationService.js";
import { DuplicateAutomationService } from "../../domains/automations/builder/application/DuplicateAutomationService.js";
import { DeleteAutomationService } from "../../domains/automations/builder/application/DeleteAutomationService.js";
import { GetBuilderWorkspaceService } from "../../domains/automations/builder/application/GetBuilderWorkspaceService.js";
import { SaveDraftService } from "../../domains/automations/builder/application/SaveDraftService.js";
import { SetAutomationArchivedService } from "../../domains/automations/catalog/application/SetAutomationArchivedService.js";
import { ListAutomationsService } from "../../domains/automations/catalog/application/ListAutomationsService.js";
import { MoveAutomationToFolderService } from "../../domains/automations/catalog/application/MoveAutomationToFolderService.js";
import { CreateFolderService } from "../../domains/automations/catalog/application/CreateFolderService.js";
import { buildInitialBuilderWorkspace } from "../../apps/api/composition/buildInitialBuilderWorkspace.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Automatizaciones en PostgreSQL (FASE C1/C2), contra la rama `test` de Neon.
//
// Se prueba a dos niveles: los repositorios (constraints, aislamiento, jsonb)
// y los casos de uso REALES sobre ellos, igual que los compone la API.
// ---------------------------------------------------------------------------

let sql: SqlClient;

async function insertTenant(key: string): Promise<string> {
  const result = await sql.query<{ id: string }>(
    "insert into tenants (key, name) values ($1, $2) returning id",
    [TEST_KEY_PREFIX + key, key]
  );
  return result.rows[0]!.id;
}

function stack() {
  const automations = new SqlAutomationRepository(sql);
  const folders = new SqlFolderRepository(sql);
  const workspaces = new UpgradingBuilderWorkspaceRepository(new SqlBuilderWorkspaceRepository(sql));
  const uow = new SqlAutomationsUnitOfWork(sql, (inner) => new UpgradingBuilderWorkspaceRepository(inner));
  return {
    automations,
    folders,
    workspaces,
    create: new CreateAutomationService(uow, buildInitialBuilderWorkspace),
    duplicate: new DuplicateAutomationService(uow, buildInitialBuilderWorkspace),
    remove: new DeleteAutomationService(uow),
    open: new GetBuilderWorkspaceService(workspaces, buildInitialBuilderWorkspace, automations),
    save: new SaveDraftService(uow),
    archive: new SetAutomationArchivedService(automations),
    list: new ListAutomationsService(automations, folders, workspaces),
    move: new MoveAutomationToFolderService(automations, folders),
    createFolder: new CreateFolderService(folders)
  };
}

beforeAll(() => {
  sql = createTestSqlClient();
});

beforeEach(async () => {
  await cleanupTestData(sql);
});

afterAll(async () => {
  await cleanupTestData(sql);
  await sql.close();
});

describe("ciclo de vida completo sobre PostgreSQL", () => {
  it("crear → abrir → guardar → listar → duplicar → archivar → borrar", async () => {
    const tenant = await insertTenant("ciclo");
    const s = stack();

    const flow = await s.create.execute(tenant, { name: "Bienvenida" });
    const opened = (await s.open.execute(tenant, flow.key))!;
    expect(opened.draft.nodes[opened.draft.version.entryNodeId]?.type).toBe("start");

    // Guardar un borrador con un bloque más y un nombre nuevo.
    const startId = opened.draft.version.entryNodeId;
    const edited = {
      ...opened.draft,
      flow: { ...opened.draft.flow, name: "Bienvenida clientes" },
      nodes: {
        ...opened.draft.nodes,
        hola: { id: "hola", type: "message" as const, name: "Hola", content: {}, config: { items: [{ id: "t", kind: "text", text: "¡Hola!" }] }, metadata: { ui: { x: 300, y: 200 } } }
      },
      edgesBySource: { [startId]: [{ id: "e1", fromNodeId: startId, toNodeId: "hola", priority: 10, isFallback: false, condition: { operator: "always" as const } }] }
    };
    const saved = await s.save.execute(opened, edited);
    expect(saved.autosaveRevision).toBe(opened.autosaveRevision + 1);

    // El documento vuelve idéntico (jsonb ida y vuelta) y el catálogo tiene el nombre nuevo.
    const reopened = (await s.open.execute(tenant, flow.key))!;
    expect(reopened.draft.nodes.hola).toEqual(edited.nodes.hola);
    expect(reopened.draft.flow.name).toBe("Bienvenida clientes");

    const listed = await s.list.execute(tenant);
    expect(listed.flows.map((item) => [item.flow.name, item.graphSummary.nodeCount])).toEqual([["Bienvenida clientes", 2]]);

    const copy = await s.duplicate.execute(tenant, flow.id);
    expect((await s.open.execute(tenant, copy.key))!.draft.nodes.hola).toEqual(edited.nodes.hola);

    expect((await s.archive.execute(tenant, flow.id, true)).status).toBe("archived");
    expect((await s.automations.findById(tenant, flow.id))?.status).toBe("archived");

    await s.remove.execute(tenant, flow.id);
    expect(await s.automations.findById(tenant, flow.id)).toBeUndefined();
    expect(await s.workspaces.getWorkspace(tenant, flow.key)).toBeNull();
    expect((await s.list.execute(tenant)).flows).toHaveLength(1);
  });

  it("carpetas: crear, mover dentro y fuera", async () => {
    const tenant = await insertTenant("carpetas");
    const s = stack();
    const folder = await s.createFolder.execute(tenant, "Ventas");
    const flow = await s.create.execute(tenant, { folderId: folder.id });

    expect((await s.automations.findById(tenant, flow.id))?.folderId).toBe(folder.id);
    await s.move.execute(tenant, flow.id, null);
    expect((await s.automations.findById(tenant, flow.id))?.folderId).toBeUndefined();
    expect((await s.folders.findByTenant(tenant)).map((f) => f.name)).toEqual(["Ventas"]);
  });
});

describe("aislamiento entre cuentas", () => {
  it("lo de una cuenta no se lee, no se mueve ni se borra desde otra", async () => {
    const a = await insertTenant("a");
    const b = await insertTenant("b");
    const s = stack();
    const flowA = await s.create.execute(a, { name: "Solo de A" });

    expect(await s.automations.findByTenant(b)).toEqual([]);
    expect(await s.automations.findById(b, flowA.id)).toBeUndefined();
    expect(await s.open.execute(b, flowA.key)).toBeNull();

    await s.remove.execute(b, flowA.id);
    expect(await s.automations.findById(a, flowA.id)).toBeDefined();
  });

  it("guardar con el id de otra cuenta no sobrescribe su fila", async () => {
    const a = await insertTenant("dueno");
    const b = await insertTenant("intruso");
    const s = stack();
    const flowA = await s.create.execute(a, { name: "Original" });

    await expect(s.automations.save({ ...flowA, tenantId: b, name: "Pisado" })).rejects.toThrow();
    expect((await s.automations.findById(a, flowA.id))?.name).toBe("Original");
  });

  it("un id que no es uuid se trata como inexistente (sin error de base de datos)", async () => {
    const s = stack();
    expect(await s.automations.findByTenant("test-tenant")).toEqual([]);
    expect(await s.automations.findById(randomUUID(), "no-es-uuid")).toBeUndefined();
    expect(await s.workspaces.getWorkspace("test-tenant", "x")).toBeNull();
  });
});

describe("integridad", () => {
  it("un borrador sin su automatización se rechaza (FK)", async () => {
    const tenant = await insertTenant("huerfano");
    const repo = new SqlBuilderWorkspaceRepository(sql);
    const orphan = buildInitialBuilderWorkspace(tenant, randomUUID());

    await expect(repo.saveWorkspace(orphan)).rejects.toThrow();
  });

  it("borrar la cuenta borra sus automatizaciones, borradores y carpetas (cascada)", async () => {
    const tenant = await insertTenant("cascada");
    const s = stack();
    await s.createFolder.execute(tenant, "Tmp");
    const flow = await s.create.execute(tenant);

    await sql.query("delete from tenants where id = $1", [tenant]);
    const left = await sql.query<{ n: string }>(
      `select (select count(*) from automations where tenant_id = $1)
            + (select count(*) from automation_drafts where tenant_id = $1)
            + (select count(*) from automation_folders where tenant_id = $1) as n`,
      [tenant]
    );
    expect(Number(left.rows[0]!.n)).toBe(0);
    expect(flow.id).toBeDefined();
  });

  it("estado y nombre vacío están acotados por constraints", async () => {
    const tenant = await insertTenant("constraints");
    const s = stack();
    const flow = await s.create.execute(tenant);

    await expect(sql.query("update automations set status = 'publicado' where id = $1", [flow.id])).rejects.toThrow();
    await expect(sql.query("update automations set name = '  ' where id = $1", [flow.id])).rejects.toThrow();
  });
});

describe("transacciones (C3)", () => {
  it("si algo falla a mitad, no queda nada guardado (rollback)", async () => {
    const tenant = await insertTenant("rollback");
    const uow = new SqlAutomationsUnitOfWork(sql);
    const id = randomUUID();

    await expect(
      uow.run(async ({ automations }) => {
        await automations.save({
          id, tenantId: tenant, key: id, name: "A medias", status: "draft",
          metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        });
        throw new Error("fallo después de escribir el catálogo");
      })
    ).rejects.toThrow("fallo después");

    expect(await new SqlAutomationRepository(sql).findById(tenant, id)).toBeUndefined();
  });

  it("crear: si el borrador no se puede guardar, tampoco queda la entrada del catálogo", async () => {
    const tenant = await insertTenant("crear-atomico");
    const brokenFactory = (tenantId: string, flowKey: string) =>
      ({ ...buildInitialBuilderWorkspace(tenantId, flowKey), autosaveRevision: -1 }); // viola revision >= 0
    const create = new CreateAutomationService(new SqlAutomationsUnitOfWork(sql), brokenFactory);

    await expect(create.execute(tenant, { name: "No debe quedar" })).rejects.toThrow();
    expect(await new SqlAutomationRepository(sql).findByTenant(tenant)).toEqual([]);
  });
});

describe("edición concurrente (C4)", () => {
  it("dos guardados sobre la misma revisión: el segundo se rechaza y el primero no se pierde", async () => {
    const tenant = await insertTenant("concurrencia");
    const s = stack();
    const flow = await s.create.execute(tenant, { name: "Compartido" });
    const tabA = (await s.open.execute(tenant, flow.key))!;
    const tabB = (await s.open.execute(tenant, flow.key))!;

    const fromA = { ...tabA.draft, flow: { ...tabA.draft.flow, name: "Cambio de A" } };
    const fromB = { ...tabB.draft, flow: { ...tabB.draft.flow, name: "Cambio de B" } };

    await s.save.execute(tabA, fromA, { baseRevision: tabA.autosaveRevision });
    await expect(s.save.execute(tabB, fromB, { baseRevision: tabB.autosaveRevision })).rejects.toMatchObject({ statusCode: 409 });

    const now = (await s.open.execute(tenant, flow.key))!;
    expect(now.draft.flow.name).toBe("Cambio de A");
    expect(now.autosaveRevision).toBe(tabA.autosaveRevision + 1);
  });

  it("la comprobación es atómica: aunque dos escrituras lean la misma revisión, solo entra una", async () => {
    const tenant = await insertTenant("carrera");
    const s = stack();
    const flow = await s.create.execute(tenant);
    const base = (await s.open.execute(tenant, flow.key))!;
    const repo = new SqlBuilderWorkspaceRepository(sql);
    const next = (name: string) => ({ ...base, draft: { ...base.draft, flow: { ...base.draft.flow, name } }, autosaveRevision: base.autosaveRevision + 1 });

    const results = await Promise.allSettled([
      repo.saveWorkspace(next("uno"), { expectedRevision: base.autosaveRevision }),
      repo.saveWorkspace(next("dos"), { expectedRevision: base.autosaveRevision })
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
});
