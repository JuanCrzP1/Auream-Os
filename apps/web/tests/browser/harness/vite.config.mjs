import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * Empaqueta el banco de pruebas con los MISMOS alias que la aplicación, para
 * que lo que se prueba sea el código de producción y no una copia.
 */
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("../../../src/shared", import.meta.url)),
      "@features": fileURLToPath(new URL("../../../src/features", import.meta.url)),
      "@app": fileURLToPath(new URL("../../../src/app", import.meta.url)),
      "@contracts": fileURLToPath(new URL("../../../../../contracts", import.meta.url))
    }
  }
});
