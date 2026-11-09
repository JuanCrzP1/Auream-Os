import { describe, expect, it } from "vitest";
import { FlowEditingService } from "../../domains/automations/editing/application/FlowEditingService.js";
import { addBlock } from "../../domains/automations/editing/domain/FlowDraftEditor.js";
import { ConflictError } from "../../platform/observability/errors/ConflictError.js";
import { createInMemoryBuilder } from "../helpers/inMemoryBuilder.js";

// ---------------------------------------------------------------------------
// Editar un flujo fuera del editor con los casos de uso reales del builder:
// el cambio se guarda en el borrador (lo que corre), el nombre llega al
// catálogo y, si alguien guardó a la vez, se reaplica sobre su versión sin
// pisarla.
// ---------------------------------------------------------------------------

const T = "tenant-1";

function setup() {
  const builder = createInMemoryBuilder();
  let n = 0;
  const service = new FlowEditingService({
    listAutomations: builder.services.listAutomationsService,
    getWorkspace: builder.services.getWorkspaceService,
    saveDraft: builder.services.saveDraftService,
    createAutomation: builder.services.createAutomationService,
    ids: { newId: (prefix) => `${prefix}-${++n}` }
  });
  return { builder, service };
}

describe("FlowEditingService", () => {
  it("crea un flujo, lo renombra (también en el catálogo) y lo encuentra por id o por clave", async () => {
    const { builder, service } = setup();
    const created = await service.createFlow(T, { name: " Bienvenida " });
    expect([created.flow.name, Object.keys(created.draft.nodes)]).toEqual(["Bienvenida", [created.draft.version.entryNodeId]]);

    const renamed = await service.renameFlow(T, created.flow.key, "Bienvenida 2026");
    expect(renamed.flow.name).toBe("Bienvenida 2026");
    expect(builder.catalog.items[0]!.name).toBe("Bienvenida 2026");
    await expect(service.createFlow(T, { name: "  " })).rejects.toThrow(/nombre/);
    await expect(service.read(T, "no-existe")).rejects.toThrow(/list_flows/);
    await expect(service.read("otra-cuenta", created.flow.id)).rejects.toThrow(/no existe/);
  });

  it("si alguien guardó a la vez, vuelve a leer y aplica el cambio sobre la versión nueva", async () => {
    const { builder, service } = setup();
    const { flow } = await service.createFlow(T, { name: "Ventas" });

    // El editor (otra pestaña) guarda justo antes que el agente: un bloque suyo.
    let first = true;
    const racing = new FlowEditingService({
      listAutomations: builder.services.listAutomationsService,
      getWorkspace: builder.services.getWorkspaceService,
      createAutomation: builder.services.createAutomationService,
      ids: { newId: (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}` },
      saveDraft: {
        execute: async (workspace, draft, options) => {
          if (first) {
            first = false;
            const theirs = addBlock(workspace.draft, { type: "tags", name: "Del editor" }, { newId: () => "tags-editor" }).draft;
            await builder.services.saveDraftService.execute(workspace, theirs);
            throw new ConflictError("El borrador cambió.");
          }
          return builder.services.saveDraftService.execute(workspace, draft, options);
        }
      }
    });

    const edited = await racing.edit(T, flow.id, (draft, ids) => addBlock(draft, { type: "message", name: "Del agente" }, ids));
    expect(Object.values(edited.draft.nodes).map((node) => node.name).sort()).toEqual(["Del agente", "Del editor", "Inicio"]);
    expect((await service.read(T, flow.id)).draft.nodes["tags-editor"]).toBeDefined();
  });

  it("un cambio inválido no guarda nada", async () => {
    const { builder, service } = setup();
    const { flow } = await service.createFlow(T, { name: "Ventas" });
    const before = [...builder.workspaces.items.values()][0]!.autosaveRevision;
    await expect(service.edit(T, flow.id, (draft, ids) => addBlock(draft, { type: "message", after: { blockId: "no-existe" } }, ids))).rejects.toThrow(/no existe/);
    expect([...builder.workspaces.items.values()][0]!.autosaveRevision).toBe(before);
  });
});
