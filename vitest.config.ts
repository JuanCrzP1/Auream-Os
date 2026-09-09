import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

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
    extensions: [".ts", ".js"],
    alias: {
      // Mismo significado que en `apps/web/vite.config.ts` y su vitest:
      // contratos canónicos compartidos, fuente única en `/contracts`.
      //
      // Hace falta porque `tests/contract/toolRegistryParity.test.ts` importa
      // la mitad PURA del catálogo de herramientas, y una definición puede
      // necesitar un valor del contrato compartido —no solo un tipo—: los tipos
      // se borran al compilar y nunca se resolvieron, un valor sí. Sin el alias
      // el test fallaba al cargar `wait-response/definition.ts`.
      //
      // NO afecta a la barrera de React: la impone `extensions`, que sigue sin
      // `.tsx`, así que importar un módulo de UI desde la cadena pura sigue
      // fallando aquí igual que antes.
      "@contracts": fileURLToPath(new URL("./contracts", import.meta.url))
    }
  }
});
