import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFolder } from "../../src/features/automations/list/services/createFolder";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("createFolder", () => {
  it("llama a POST /automations/folders con el nombre", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: "folder-1", name: "Ventas" })
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const folder = await createFolder("Ventas");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/automations/folders");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Ventas" });
    expect(folder).toEqual({ id: "folder-1", name: "Ventas" });
  });

  it("NO envía el tenant en el cuerpo: lo resuelve el servidor", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: "folder-1", name: "Ventas" })
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    await createFolder("Ventas");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).not.toHaveProperty("tenantId");
  });

  it("propaga errores del servidor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error"
    } as unknown as Response));

    await expect(createFolder("Ventas")).rejects.toThrow("500");
  });
});
