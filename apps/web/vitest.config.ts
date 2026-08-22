import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
      "@features": fileURLToPath(new URL("./src/features", import.meta.url)),
      "@app": fileURLToPath(new URL("./src/app", import.meta.url)),
      // Contratos canónicos compartidos con el backend. Fuente única: /contracts.
      "@contracts": fileURLToPath(new URL("../../contracts", import.meta.url))
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/shared/test-utils/setup.ts"],
    typecheck: { tsconfig: "./tsconfig.test.json" }
  }
});
