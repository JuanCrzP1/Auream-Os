import { afterEach, describe, expect, it, vi } from "vitest";
import { getDevApiKey } from "../../src/shared/config/getDevApiKey";

// ---------------------------------------------------------------------------
// Protege el defecto investigado en el frontend: si VITE_DEV_API_KEY no está
// definida, el cliente HTTP no debe enviar ninguna credencial (nunca un
// valor hardcodeado). Si está definida, debe devolverla tal cual — el mismo
// valor que ensure-dev-key.mjs escribe en apps/web/.env.local.
//
// vi.stubEnv actúa sobre el mismo import.meta.env que Vite expone en
// ejecución real (verificado empíricamente contra apps/web/.env.local antes
// de escribir este test).
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getDevApiKey", () => {
  it("devuelve null si VITE_DEV_API_KEY no esta definida", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_DEV_API_KEY", undefined);

    expect(getDevApiKey()).toBeNull();
  });

  it("devuelve el valor de VITE_DEV_API_KEY en modo desarrollo", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_DEV_API_KEY", "bfk_dev_test0000");

    expect(getDevApiKey()).toBe("bfk_dev_test0000");
  });

  it("nunca devuelve una credencial fuera de modo desarrollo, aunque este definida", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_DEV_API_KEY", "bfk_dev_test0000");

    expect(getDevApiKey()).toBeNull();
  });
});
