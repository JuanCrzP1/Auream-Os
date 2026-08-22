import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteAutomation } from "../../src/features/automations/list/services/deleteAutomation";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("deleteAutomation", () => {
  it("llama a DELETE /automations/:id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ deleted: true }),
      headers: { get: () => null }
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    await deleteAutomation("flow-123");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/automations/flow-123");
    expect(init.method).toBe("DELETE");
  });

  it("propaga errores 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "Not Found"
    } as unknown as Response));

    await expect(deleteAutomation("no-existe")).rejects.toThrow("404");
  });

  it("propaga errores 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error"
    } as unknown as Response));

    await expect(deleteAutomation("flow-x")).rejects.toThrow("500");
  });
});
