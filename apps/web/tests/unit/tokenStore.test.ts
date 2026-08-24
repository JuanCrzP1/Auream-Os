import { afterEach, describe, expect, it, vi } from "vitest";
import { tokenStore } from "../../src/shared/auth/client/tokenStore";

// ---------------------------------------------------------------------------
// El token vive en memoria y sólo se pide cuando hay sesión.
// Sin esta garantía, cada petición a la API dispararía una llamada de red
// inútil al proveedor de identidad.
// ---------------------------------------------------------------------------

afterEach(() => {
  tokenStore.clear();
  vi.restoreAllMocks();
});

function futureToken(secondsFromNow: number): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + secondsFromNow }));
  return `header.${payload}.signature`;
}

describe("tokenStore", () => {
  it("sin sesión no pide token ni hace red", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(await tokenStore.get()).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("con sesión obtiene el token y lo reutiliza desde memoria", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: futureToken(900) })
    });
    vi.stubGlobal("fetch", fetchSpy);
    tokenStore.setSessionPresent(true);

    const first = await tokenStore.get();
    const second = await tokenStore.get();

    expect(first).toBe(second);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("un token a punto de caducar se renueva", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: futureToken(10) })
    });
    vi.stubGlobal("fetch", fetchSpy);
    tokenStore.setSessionPresent(true);

    await tokenStore.get();
    await tokenStore.get();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("si la sesión caduca devuelve null en lugar de propagar el error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    tokenStore.setSessionPresent(true);

    expect(await tokenStore.get()).toBeNull();
  });

  it("clear olvida el token y la sesión", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ token: futureToken(900) })
    }));
    tokenStore.setSessionPresent(true);
    await tokenStore.get();

    tokenStore.clear();

    expect(await tokenStore.get()).toBeNull();
  });
});
