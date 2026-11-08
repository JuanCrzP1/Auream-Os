import { describe, expect, it } from "vitest";
import { UpgradingBuilderWorkspaceRepository } from "../../domains/automations/builder/application/UpgradingBuilderWorkspaceRepository.js";
import type { BuilderWorkspaceRepository } from "../../domains/automations/builder/application/BuilderWorkspaceRepository.js";
import type { PersistedBuilderWorkspace } from "../../contracts/BuilderContracts.js";
import type { BuilderFlowSnapshot } from "../../contracts/FlowSnapshot.js";

const legacySnapshot: BuilderFlowSnapshot = {
  flow: { id: "f", key: "f", name: "F" },
  version: { id: "v", versionNumber: 1, status: "draft", entryNodeId: "start_message" },
  nodes: {
    start_message: {
      id: "start_message", type: "message", name: "Inicio",
      content: { text: "Inicio del flujo" }, config: {}, metadata: { ui: { x: 200, y: 220 } }
    }
  },
  edgesBySource: {}
};

/** Como está en disco un workspace anterior: inicio `message` e historial de publicación. */
const legacy = {
  tenantId: "t",
  flowKey: "f",
  draft: legacySnapshot,
  publishedSnapshots: [{ ...legacySnapshot, version: { ...legacySnapshot.version, status: "published" } }],
  updatedAt: "2026-08-30T00:00:00.000Z",
  autosaveRevision: 3
} as PersistedBuilderWorkspace;

class StubRepository implements BuilderWorkspaceRepository {
  public saved: PersistedBuilderWorkspace[] = [];
  public constructor(private readonly stored: PersistedBuilderWorkspace) {}
  async getWorkspace() { return this.stored; }
  async getWorkspaces() { return [this.stored]; }
  async saveWorkspace(workspace: PersistedBuilderWorkspace) { this.saved.push(workspace); }
  async deleteWorkspace() {}
}

describe("UpgradingBuilderWorkspaceRepository", () => {
  it("sirve el borrador con el bloque de inicio migrado", async () => {
    const repository = new UpgradingBuilderWorkspaceRepository(new StubRepository(legacy));
    const workspace = await repository.getWorkspace("t", "f");

    expect(workspace?.draft.nodes.start_message.type).toBe("start");
  });

  it("descarta el historial de publicación: los flujos ya no se publican", async () => {
    const workspace = await new UpgradingBuilderWorkspaceRepository(new StubRepository(legacy)).getWorkspace("t", "f");

    expect(workspace).not.toHaveProperty("publishedSnapshots");
    expect(workspace?.autosaveRevision).toBe(3);
  });

  it("migra también las lecturas del listado del Hub", async () => {
    const repository = new UpgradingBuilderWorkspaceRepository(new StubRepository(legacy));
    const [workspace] = await repository.getWorkspaces("t", ["f"]);

    expect(workspace.draft.nodes.start_message.type).toBe("start");
  });

  it("no altera lo almacenado: solo la lectura cambia", async () => {
    const inner = new StubRepository(legacy);
    await new UpgradingBuilderWorkspaceRepository(inner).getWorkspace("t", "f");

    expect(legacy.draft.nodes.start_message.type).toBe("message");
    expect(inner.saved).toEqual([]);
  });

  it("devuelve el mismo objeto si no hay nada que migrar", async () => {
    const current = (await new UpgradingBuilderWorkspaceRepository(new StubRepository(legacy)).getWorkspace("t", "f"))!;
    const again = await new UpgradingBuilderWorkspaceRepository(new StubRepository(current)).getWorkspace("t", "f");

    expect(again).toBe(current);
  });
});
