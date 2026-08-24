import "@testing-library/jest-dom";
import { vi } from "vitest";

// La URL del proveedor de identidad debe existir para que el cliente de auth
// pueda construirse. Es un valor de prueba: ningún test hace red real contra él.
vi.stubEnv("VITE_NEON_AUTH_URL", "https://auth.test.local/neondb/auth");

// Por defecto no hay sesión. Los tests que necesiten otra cosa sustituyen fetch.
if (!globalThis.fetch) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => null }));
}
