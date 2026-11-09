import { describe, expect, it, vi } from "vitest";
import { ContactAvatarService, type ContactAvatarStore } from "../../domains/contacts/application/ContactAvatarService.js";

// La foto de perfil de un contacto: se pide al proveedor cuando escribe y la
// última revisión tiene más de un día; sin foto se guarda vacía (iniciales);
// si el proveedor falla no se guarda nada y se reintenta después.

const T = "t1";

function setup(checkedAt: string | null, start = Date.parse("2026-11-10T12:00:00.000Z")) {
  const clock = { ms: start };
  const saved: Array<[string, string | null, string]> = [];
  const store: ContactAvatarStore = {
    findByPhone: async (_tenant, phone) => (phone === "573001112233" ? { contactId: "c1", checkedAt } : null),
    save: async (_tenant, contactId, url, at) => void saved.push([contactId, url, at])
  };
  return { clock, saved, service: new ContactAvatarService(store, () => new Date(clock.ms)) };
}

describe("ContactAvatarService", () => {
  it("la pide la primera vez y después a lo sumo una vez al día", async () => {
    const s = setup(null);
    const fetch = vi.fn(async () => "https://pps.whatsapp.net/v/laura.jpg");
    expect(await s.service.refreshIfStale(T, "573001112233", fetch)).toBe(true);
    expect(s.saved).toEqual([["c1", "https://pps.whatsapp.net/v/laura.jpg", "2026-11-10T12:00:00.000Z"]]);

    const recent = setup("2026-11-10T00:00:00.000Z");
    expect(await recent.service.refreshIfStale(T, "573001112233", fetch)).toBe(false);
    const old = setup("2026-11-09T11:00:00.000Z");
    expect(await old.service.refreshIfStale(T, "573001112233", fetch)).toBe(true);
  });

  it("sin foto se guarda vacía; si el proveedor falla o el contacto no existe, no se guarda nada", async () => {
    const s = setup(null);
    await s.service.refreshIfStale(T, "573001112233", async () => null);
    expect(s.saved[0]![1]).toBeNull();
    const failing = setup(null);
    expect(await failing.service.refreshIfStale(T, "573001112233", async () => { throw new Error("uazapi caído"); })).toBe(false);
    expect(await failing.service.refreshIfStale(T, "570000000000", async () => "x")).toBe(false);
    expect(failing.saved).toEqual([]);
  });
});
