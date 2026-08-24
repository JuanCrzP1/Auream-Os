import { defineConfig } from "vitest/config";

// ---------------------------------------------------------------------------
// Configuración exclusiva de los tests de integración.
//
// Separada de vitest.config.ts a propósito: `npm test` no incluye
// tests/integration/**, así que la suite unitaria no puede tocar la red aunque
// alguien coloque un test de integración por error.
// ---------------------------------------------------------------------------

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/setup/globalSetup.ts"],
    // Las pruebas comparten una base real: se ejecutan en serie para que el
    // aislamiento entre casos sea explícito y no dependa del orden.
    fileParallelism: false,
    testTimeout: 30_000
  },
  resolve: {
    extensions: [".ts", ".js"]
  }
});
