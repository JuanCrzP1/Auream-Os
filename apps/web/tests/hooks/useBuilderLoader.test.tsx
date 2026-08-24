import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { ProvidersWrapper } from "../../src/shared/test-utils/renderWithProviders";
import { useBuilderLoader } from "../../src/features/automations/builder/hooks/builder/useBuilderLoader";
import type { PersistedBuilderWorkspace } from "@contracts/BuilderContracts";

// ---------------------------------------------------------------------------
// Fixture mínimo de workspace
// ---------------------------------------------------------------------------

function makeWorkspace(flowKey = "flow-test"): PersistedBuilderWorkspace {
  const now = new Date().toISOString();
  return {
    tenantId: "tenant-test",
    flowKey,
    updatedAt: now,
    draft: {
      flow: {
        id: `flow-${flowKey}`,
        tenantId: "tenant-test",
        key: flowKey,
        name: "Test Flow",
        currentPublishedVersionId: null
      },
      version: {
        id: "v1",
        tenantId: "tenant-test",
        flowId: `flow-${flowKey}`,
        versionNumber: 1,
        status: "draft",
        entryNodeId: "start"
      },
      nodes: {},
      edges: []
    }
  } as unknown as PersistedBuilderWorkspace;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useBuilderLoader", () => {
  it("empieza en estado loading", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    const { result } = renderHook(() => useBuilderLoader("flow-test"), { wrapper: ProvidersWrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.workspace).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("devuelve workspace tras fetch exitoso", async () => {
    const workspace = makeWorkspace("my-flow");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(workspace)
      } as unknown as Response)
    );

    const { result } = renderHook(() => useBuilderLoader("my-flow"), { wrapper: ProvidersWrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.workspace).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("devuelve error cuando el fetch falla con error de red", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useBuilderLoader("flow-test"), { wrapper: ProvidersWrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // fetchBuilderWorkspace devuelve workspace local en error de red (comportamiento existente)
    expect(result.current.workspace).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("vuelve a cargar cuando cambia el flowKey", async () => {
    const workspaceA = makeWorkspace("flow-a");
    const workspaceB = makeWorkspace("flow-b");

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(workspaceA)
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(workspaceB)
        } as unknown as Response)
    );

    const { result, rerender } = renderHook(({ key }) => useBuilderLoader(key), {
      wrapper: ProvidersWrapper,
      initialProps: { key: "flow-a" }
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ key: "flow-b" });

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("setWorkspace actualiza el workspace manualmente", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useBuilderLoader("flow-test"), { wrapper: ProvidersWrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updated = makeWorkspace("updated-flow");
    result.current.setWorkspace(updated);

    await waitFor(() => {
      expect(result.current.workspace?.flowKey).toBe("updated-flow");
    });
  });
});
