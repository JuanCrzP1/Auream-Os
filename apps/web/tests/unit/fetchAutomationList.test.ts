import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAutomationList } from "../../src/features/automations/list/services/fetchAutomationList";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchAutomationList", () => {
  it("returns empty on network error (TypeError)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const result = await fetchAutomationList();
    expect(result).toEqual({ flows: [], folders: [] });
  });

  it("returns empty on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "Not Found" } as unknown as Response));
    const result = await fetchAutomationList();
    expect(result).toEqual({ flows: [], folders: [] });
  });

  it("throws on 500 server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "Internal Server Error" } as unknown as Response));
    await expect(fetchAutomationList()).rejects.toThrow("500");
  });

  it("returns data on 200 OK", async () => {
    const mockData = { flows: [{ id: "1", key: "k", name: "F", status: "active", updatedAt: "2024-01-01" }], folders: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData
    } as unknown as Response));
    const result = await fetchAutomationList();
    expect(result.flows).toHaveLength(1);
    expect(result.flows[0].name).toBe("F");
  });
});
