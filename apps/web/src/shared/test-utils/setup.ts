import "@testing-library/jest-dom";
import { vi } from "vitest";

// La URL del proveedor de identidad debe existir para que el cliente de auth
// pueda construirse. Es un valor de prueba: ningún test hace red real contra él.
vi.stubEnv("VITE_NEON_AUTH_URL", "https://auth.test.local/neondb/auth");

// Por defecto no hay sesión. Los tests que necesiten otra cosa sustituyen fetch.
if (!globalThis.fetch) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => null }));
}

// Node 25 expone un `localStorage` global propio (sin `--localstorage-file` es
// un objeto vacío sin métodos) que tapa el de jsdom. Si el que hay no es un
// Storage usable, se sustituye por uno en memoria con la misma API.
function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, String(value))
  };
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  if (typeof globalThis[name]?.clear !== "function") {
    vi.stubGlobal(name, createMemoryStorage());
  }
}
