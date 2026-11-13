import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Reporter, TestModule } from "vitest/node";

// ---------------------------------------------------------------------------
// Informe en español de los recorridos de punta a punta: qué pasó, qué falló y
// por qué, en `data/e2e/informe.md` (la carpeta `data/` no se sube a git).
// Se puede leer sin saber de pruebas: cada paso es una frase del negocio.
// ---------------------------------------------------------------------------

const MARK = { passed: "✅", failed: "❌", skipped: "⏭️", pending: "⏳" } as const;
const seconds = (ms: number) => `${(ms / 1000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} s`;

export default class SpanishReport implements Reporter {
  onTestRunEnd(modules: ReadonlyArray<TestModule>): void {
    const lines: string[] = ["# Informe de los recorridos", "", `Corrida: ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })} (hora de Colombia)`, ""];
    let passed = 0;
    let failed = 0;
    for (const module of modules) {
      lines.push(`## ${relative(process.cwd(), module.moduleId)}`, "");
      for (const test of module.children.allTests()) {
        const result = test.result();
        const state = result.state;
        if (state === "passed") passed += 1;
        if (state === "failed") failed += 1;
        const duration = test.diagnostic()?.duration ?? 0;
        lines.push(`- ${MARK[state]} ${test.name} · ${seconds(duration)}`);
        for (const error of result.errors ?? []) lines.push(`  - Por qué falló: ${String(error.message).split("\n")[0]}`);
      }
      for (const error of module.errors()) {
        failed += 1;
        lines.push(`- ❌ No arrancó: ${String(error.message).split("\n")[0]}`);
      }
      lines.push("");
    }
    lines.splice(4, 0, failed === 0 ? `**Todo bien: ${passed} pasos pasaron.**` : `**Algo falló: ${failed} con error y ${passed} pasos bien.**`, "");
    const dir = join(process.cwd(), "data", "e2e");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "informe.md"), `${lines.join("\n")}\n`);
    console.log(`\n[e2e] informe: ${relative(process.cwd(), join(dir, "informe.md"))}`);
  }
}
