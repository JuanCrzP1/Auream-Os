import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
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

  // -------------------------------------------------------------------------
  // LO CONFIRMADO POR EL SERVIDOR NO ES LO QUE HAY EN PANTALLA.
  //
  // El autoguardado decide si hay algo nuevo que mandar comparando el borrador
  // vivo con lo último que el servidor confirmó. Mientras las dos cosas fueron
  // la misma variable, editar en local movía también la referencia: renombrar
  // el flujo se marcaba a sí mismo como guardado y no salía nunca de aquí.
  // -------------------------------------------------------------------------

  describe("firma confirmada por el servidor", () => {
    async function cargar(flowKey = "mi-flujo") {
      const workspace = makeWorkspace(flowKey);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(workspace)
        } as unknown as Response)
      );

      const vista = renderHook(() => useBuilderLoader(flowKey), { wrapper: ProvidersWrapper });
      await waitFor(() => expect(vista.result.current.loading).toBe(false));
      return vista;
    }

    it("al cargar, la firma es la del workspace que vino del servidor", async () => {
      const { result } = await cargar();

      expect(result.current.serverSignature).toBe(JSON.stringify(result.current.workspace?.draft));
    });

    it("RENOMBRAR cambia el borrador pero NO la firma confirmada", async () => {
      const { result } = await cargar();
      const firmaAlCargar = result.current.serverSignature;

      act(() => result.current.renameFlow("Bienvenida a clientes"));

      // Lo que se ve cambió...
      expect(result.current.workspace?.draft.flow.name).toBe("Bienvenida a clientes");
      // ...y lo que el servidor tiene, no. Esa diferencia es justo lo que hace
      // que el autoguardado detecte que hay algo que mandar.
      expect(result.current.serverSignature).toBe(firmaAlCargar);
      expect(JSON.stringify(result.current.workspace?.draft)).not.toBe(firmaAlCargar);
    });

    it("la firma solo avanza cuando el servidor confirma", async () => {
      const { result } = await cargar();
      act(() => result.current.renameFlow("Un nombre nuevo"));
      const firmaAntes = result.current.serverSignature;

      // Esto es lo que hace el autoguardado con la respuesta del servidor: el
      // workspace que vuelve ya trae el nombre guardado.
      const base = makeWorkspace("mi-flujo");
      const confirmado = {
        ...base,
        draft: { ...base.draft, flow: { ...base.draft.flow, name: "Un nombre nuevo" } }
      } as PersistedBuilderWorkspace;
      act(() => result.current.setWorkspace(confirmado));

      expect(result.current.serverSignature).not.toBe(firmaAntes);
      expect(result.current.serverSignature).toBe(JSON.stringify(confirmado.draft));
    });

    it("varios renombrados seguidos no mueven la firma ni una vez", async () => {
      const { result } = await cargar();
      const firmaAlCargar = result.current.serverSignature;

      act(() => result.current.renameFlow("Uno"));
      act(() => result.current.renameFlow("Dos"));
      act(() => result.current.renameFlow("Tres"));

      expect(result.current.workspace?.draft.flow.name).toBe("Tres");
      expect(result.current.serverSignature).toBe(firmaAlCargar);
    });
  });
});
