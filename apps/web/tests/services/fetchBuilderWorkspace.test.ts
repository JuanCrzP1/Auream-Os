import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBuilderWorkspace } from "../../src/features/automations/builder/services/fetchBuilderWorkspace";

describe("fetchBuilderWorkspace", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a local workspace when the API is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const workspace = await fetchBuilderWorkspace("flow-test", "tenant-from-session");

    expect(workspace.flowKey).toBe("flow-test");
    expect(workspace.tenantId).toBe("tenant-from-session");
    expect(workspace.draft.flow.name).toBe("Nueva automatización");
    expect(workspace.draft.version.entryNodeId).toBe("start_message");
  });
});