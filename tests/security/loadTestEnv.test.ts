import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTestEnv } from "../integration/setup/loadTestEnv.js";

// ---------------------------------------------------------------------------
// El cargador de `.env.test` alimenta las barreras que impiden que la suite de
// integración toque producción. Si leyera mal un valor, la barrera abortaría
// por un motivo equivocado — o, peor, dejaría pasar un destino incorrecto.
// ---------------------------------------------------------------------------

function withTempEnvFile(contents: string | null, run: (rootDir: string) => void): void {
  const rootDir = mkdtempSync(join(tmpdir(), "load-test-env-"));

  try {
    if (contents !== null) {
      writeFileSync(join(rootDir, ".env.test"), contents, "utf-8");
    }

    run(rootDir);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

describe("loadTestEnv", () => {
  it("vuelca las variables de .env.test", () => {
    withTempEnvFile("TEST_DATABASE_URL=postgres://ejemplo\nTEST_NEON_AUTH_URL=https://auth.test\n", (rootDir) => {
      const env: NodeJS.ProcessEnv = {};

      loadTestEnv(env, rootDir);

      expect(env["TEST_DATABASE_URL"]).toBe("postgres://ejemplo");
      expect(env["TEST_NEON_AUTH_URL"]).toBe("https://auth.test");
    });
  });

  it("nunca sobreescribe una variable ya presente: el entorno real gana", () => {
    withTempEnvFile("TEST_DATABASE_URL=postgres://del-archivo\n", (rootDir) => {
      const env: NodeJS.ProcessEnv = { TEST_DATABASE_URL: "postgres://del-entorno" };

      loadTestEnv(env, rootDir);

      expect(env["TEST_DATABASE_URL"]).toBe("postgres://del-entorno");
    });
  });

  it("quita las comillas del valor", () => {
    withTempEnvFile("TEST_DATABASE_URL=\"postgres://entrecomillado\"\n", (rootDir) => {
      const env: NodeJS.ProcessEnv = {};

      loadTestEnv(env, rootDir);

      expect(env["TEST_DATABASE_URL"]).toBe("postgres://entrecomillado");
    });
  });

  it("ignora comentarios y líneas vacías", () => {
    withTempEnvFile("# un comentario\n\nTEST_DATABASE_URL=postgres://ejemplo\n", (rootDir) => {
      const env: NodeJS.ProcessEnv = {};

      loadTestEnv(env, rootDir);

      expect(env["TEST_DATABASE_URL"]).toBe("postgres://ejemplo");
      expect(Object.keys(env)).toHaveLength(1);
    });
  });

  it("no falla si el archivo no existe", () => {
    withTempEnvFile(null, (rootDir) => {
      const env: NodeJS.ProcessEnv = {};

      expect(() => loadTestEnv(env, rootDir)).not.toThrow();
      expect(Object.keys(env)).toHaveLength(0);
    });
  });
});
