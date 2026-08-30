import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFile } from "../../apps/api/config/loadEnvFile.js";

function withTempEnvFile(contents: string | null, run: (rootDir: string) => void): void {
  const rootDir = mkdtempSync(join(tmpdir(), "load-env-file-test-"));

  try {
    if (contents !== null) {
      writeFileSync(join(rootDir, ".env"), contents, "utf-8");
    }

    run(rootDir);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

describe("loadEnvFile", () => {
  it("vuelca las variables de .env a process.env", () => {
    withTempEnvFile("DATABASE_URL=postgres://example\nNEON_AUTH_URL=https://auth.example.com\n", (rootDir) => {
      const env: NodeJS.ProcessEnv = {};

      loadEnvFile(env, rootDir);

      expect(env["DATABASE_URL"]).toBe("postgres://example");
      expect(env["NEON_AUTH_URL"]).toBe("https://auth.example.com");
    });
  });

  it("nunca sobreescribe una variable ya presente en el entorno", () => {
    withTempEnvFile("DATABASE_URL=postgres://from-file\n", (rootDir) => {
      const env: NodeJS.ProcessEnv = { DATABASE_URL: "postgres://from-real-env" };

      loadEnvFile(env, rootDir);

      expect(env["DATABASE_URL"]).toBe("postgres://from-real-env");
    });
  });

  it("ignora comentarios y lineas en blanco", () => {
    withTempEnvFile("# comentario\n\nDATABASE_URL=postgres://example\n", (rootDir) => {
      const env: NodeJS.ProcessEnv = {};

      loadEnvFile(env, rootDir);

      expect(env["DATABASE_URL"]).toBe("postgres://example");
      expect(Object.keys(env)).toEqual(["DATABASE_URL"]);
    });
  });

  it("quita comillas simples o dobles que envuelvan el valor", () => {
    withTempEnvFile('A="valor con espacios"\nB=\'otro valor\'\n', (rootDir) => {
      const env: NodeJS.ProcessEnv = {};

      loadEnvFile(env, rootDir);

      expect(env["A"]).toBe("valor con espacios");
      expect(env["B"]).toBe("otro valor");
    });
  });

  it("no falla si .env no existe: el entorno real ya provee las variables", () => {
    withTempEnvFile(null, (rootDir) => {
      const env: NodeJS.ProcessEnv = { DATABASE_URL: "postgres://ya-presente" };

      expect(() => loadEnvFile(env, rootDir)).not.toThrow();
      expect(env["DATABASE_URL"]).toBe("postgres://ya-presente");
    });
  });
});
