import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// vercel.json cumple los límites que Vercel valida ANTES de construir: si no,
// el despliegue falla sin compilar nada (pasó el 2026-11-11: `includeFiles`
// de la API pasó de 256 caracteres al sumar `content/help`).
// ---------------------------------------------------------------------------

const config = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
  functions: Record<string, { includeFiles?: string }>;
  rewrites: Array<{ source: string; destination: string }>;
};

describe("vercel.json", () => {
  it("cada `includeFiles` mide 256 caracteres o menos y la API lleva la documentación", () => {
    for (const fn of Object.values(config.functions)) if (fn.includeFiles) expect(fn.includeFiles.length).toBeLessThanOrEqual(256);
    expect(config.functions["api/index.ts"]?.includeFiles).toContain("content/help/**");
  });

  it("el enlace de grupos y llms.txt van a la API antes que la app", () => {
    const sources = config.rewrites.map((r) => r.source);
    const app = sources.indexOf("/(.*)");
    for (const source of ["/g/(.*)", "/llms.txt"]) {
      expect(sources.indexOf(source)).toBeGreaterThanOrEqual(0);
      expect(sources.indexOf(source)).toBeLessThan(app);
    }
  });
});
