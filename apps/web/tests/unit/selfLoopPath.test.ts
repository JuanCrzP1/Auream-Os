import { describe, expect, it } from "vitest";
import { selfLoopPath } from "@features/automations/builder/components/canvas/selfLoopPath";

// El lazo de «Otra respuesta» → el mismo Menú: sale por la derecha, pasa por
// debajo del bloque y entra por la izquierda, sin atravesarlo.

describe("selfLoopPath", () => {
  it("rodea el bloque por debajo y deja el botón en el centro del tramo inferior", () => {
    const { path, labelX, labelY } = selfLoopPath({ sourceX: 300, sourceY: 160, targetX: 100, targetY: 60, bottom: 200 });
    expect(path.startsWith("M 300 160")).toBe(true);
    expect(path.endsWith("L 100 60")).toBe(true);
    // Tramo inferior por debajo del borde del bloque.
    expect(labelY).toBe(236);
    expect(labelX).toBe(200);
    const ys = [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0])).filter((_, i) => i % 2 === 1);
    expect(Math.max(...ys)).toBe(236);
  });

  it("si la salida está más abajo que el bloque medido, igual pasa por debajo de ella", () => {
    expect(selfLoopPath({ sourceX: 300, sourceY: 260, targetX: 100, targetY: 60, bottom: 200 }).labelY).toBe(296);
  });
});
