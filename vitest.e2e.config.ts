import { defineConfig } from "vitest/config";

// ---------------------------------------------------------------------------
// Recorridos de punta a punta (`npm run test:e2e`): la API real de Auream con
// el WhatsApp simulado y la base de PRUEBAS. Aparte de `npm test` y de la
// integración: levantan servidores y tardan más.
//
// Al terminar dejan un informe en español en `data/e2e/informe.md`.
// ---------------------------------------------------------------------------

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/e2e/**/*.e2e.ts"],
    globalSetup: ["tests/e2e/setup/globalSetup.ts"],
    // Cada recorrido es una historia en orden, con su propia cuenta y servidores.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    reporters: ["default", "./tests/e2e/setup/spanishReport.ts"]
  },
  resolve: {
    extensions: [".ts", ".js"]
  }
});
