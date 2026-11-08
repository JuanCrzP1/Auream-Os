import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBuilderWorkspace } from "../../src/features/automations/builder/services/fetchBuilderWorkspace";

describe("fetchBuilderWorkspace", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a local workspace when the API is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { workspace, persisted } = await fetchBuilderWorkspace("flow-test", "tenant-from-session");

    // Respaldo en memoria: la interfaz debe saber que NO se guarda.
    expect(persisted).toBe(false);

    expect(workspace.flowKey).toBe("flow-test");
    expect(workspace.tenantId).toBe("tenant-from-session");
    expect(workspace.draft.flow.name).toBe("Nueva automatización");
    expect(workspace.draft.version.entryNodeId).toBe("start");
    expect(workspace.draft.nodes.start.type).toBe("start");
  });

  it("marks a workspace served by the API as persisted", async () => {
    const served = { tenantId: "t", flowKey: "flow-test", draft: {}, updatedAt: "x", autosaveRevision: 0 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(served) }));

    const { workspace, persisted } = await fetchBuilderWorkspace("flow-test", "t");

    expect(persisted).toBe(true);
    expect(workspace).toEqual(served);
  });
});
