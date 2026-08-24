import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Los tests de integración tienen su propia configuración y su propia
    // barrera de entorno: nunca deben ejecutarse con `npm test`.
    exclude: ["tests/integration/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["domains/**/*.ts", "flow-engine/**/*.ts", "platform/**/*.ts", "infrastructure/**/*.ts", "contracts/**/*.ts"],
      exclude: ["apps/**"]
    }
  },
  resolve: {
    extensions: [".ts", ".js"]
  }
});
