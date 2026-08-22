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
