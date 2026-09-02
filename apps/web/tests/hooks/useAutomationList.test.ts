import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAutomationList } from "../../src/features/automations/list/hooks/useAutomationList";

beforeEach(() => {
  vi.restoreAllMocks();
});

const mockFetchSuccess = (data: object) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
    headers: { get: () => null }
  } as unknown as Response));
};

const mockFetchError = (status: number) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: async () => `Error ${status}`
  } as unknown as Response));
};

describe("useAutomationList", () => {
  it("empieza en estado loading", () => {
    mockFetchSuccess({ flows: [], folders: [] });
    const { result } = renderHook(() => useAutomationList("tenant-1"));
    expect(result.current.status).toBe("loading");
  });

  it("pasa a success con datos del servidor", async () => {
    const data = { flows: [{ id: "1", key: "k", name: "F", status: "active", updatedAt: "2024-01-01" }], folders: [] };
    mockFetchSuccess(data);
    const { result } = renderHook(() => useAutomationList("tenant-1"));
    await waitFor(() => expect(result.current.status).toBe("success"));
    if (result.current.status === "success") {
      expect(result.current.data.flows).toHaveLength(1);
    }
  });

  it("pasa a error en 500", async () => {
    mockFetchError(500);
    const { result } = renderHook(() => useAutomationList("tenant-1"));
    await waitFor(() => expect(result.current.status).toBe("error"));
  });

  it("expone función refresh", () => {
    mockFetchSuccess({ flows: [], folders: [] });
    const { result } = renderHook(() => useAutomationList("tenant-1"));
    expect(typeof result.current.refresh).toBe("function");
  });

  it("refresh NO vuelve a loading: conserva los datos visibles", async () => {
    mockFetchSuccess({ flows: [], folders: [] });
    const { result } = renderHook(() => useAutomationList("tenant-1"));
    await waitFor(() => expect(result.current.status).toBe("success"));

    act(() => { result.current.refresh(); });

    expect(result.current.status).toBe("success");
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
  });

  it("una revalidación fallida conserva los últimos datos buenos", async () => {
    const data = { flows: [{ id: "1", key: "k", name: "F", status: "active", updatedAt: "2024-01-01" }], folders: [] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => data, headers: { get: () => null } })
      .mockResolvedValue({ ok: false, status: 500, text: async () => "Error 500" });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { result } = renderHook(() => useAutomationList("tenant-1"));
    await waitFor(() => expect(result.current.status).toBe("success"));

    act(() => { result.current.refresh(); });

    await waitFor(() => {
      if (result.current.status !== "success") throw new Error("perdió los datos");
      expect(result.current.refreshError).toContain("500");
      expect(result.current.data.flows).toHaveLength(1);
    });
  });

  it("cambiar de tenant SÍ vuelve a loading: no muestra datos ajenos", async () => {
    mockFetchSuccess({ flows: [], folders: [] });
    const { result, rerender } = renderHook(({ tenant }) => useAutomationList(tenant), {
      initialProps: { tenant: "tenant-1" }
    });
    await waitFor(() => expect(result.current.status).toBe("success"));

    rerender({ tenant: "tenant-2" });

    expect(result.current.status).toBe("loading");
  });

  it("refresh recarga los datos del servidor", async () => {
    const firstData = { flows: [], folders: [] };
    const secondData = { flows: [{ id: "2", key: "k2", name: "Nuevo Flow", status: "draft", updatedAt: "2024-01-02" }], folders: [] };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => firstData, headers: { get: () => null } })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => secondData, headers: { get: () => null } });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { result } = renderHook(() => useAutomationList("tenant-1"));
    await waitFor(() => expect(result.current.status).toBe("success"));

    act(() => { result.current.refresh(); });
    await waitFor(() => {
      if (result.current.status === "success") {
        expect(result.current.data.flows).toHaveLength(1);
        expect(result.current.data.flows[0]?.name).toBe("Nuevo Flow");
      }
    });
  });
});
