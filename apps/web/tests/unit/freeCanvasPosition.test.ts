import { describe, expect, it } from "vitest";
import { CASCADE_STEP, freeCanvasPosition } from "@features/automations/builder/services/freeCanvasPosition";

// Añadir varios bloques seguidos desde la paleta no los apila en el mismo punto.
describe("freeCanvasPosition", () => {
  it("usa el punto pedido si está libre", () => {
    expect(freeCanvasPosition({ x: 100, y: 100 }, [{ x: 400, y: 100 }])).toEqual({ x: 100, y: 100 });
  });

  it("si está ocupado, baja en cascada hasta el primer hueco", () => {
    const desired = { x: 100, y: 100 };
    const taken = [desired, { x: 100 + CASCADE_STEP.x, y: 100 + CASCADE_STEP.y }];
    expect(freeCanvasPosition(desired, taken)).toEqual({ x: 100 + 2 * CASCADE_STEP.x, y: 100 + 2 * CASCADE_STEP.y });
  });

  it("un bloque casi en el mismo punto también cuenta como ocupado", () => {
    expect(freeCanvasPosition({ x: 100, y: 100 }, [{ x: 110, y: 92 }])).not.toEqual({ x: 100, y: 100 });
  });
});

describe("freeCanvasPosition · escaleras", () => {
  it("tras una escalera completa empieza otra a la derecha, a la altura inicial", async () => {
    const { CASCADE_LENGTH, CASCADE_COLUMN_GAP } = await import("@features/automations/builder/services/freeCanvasPosition");
    const desired = { x: 0, y: 0 };
    const taken = Array.from({ length: CASCADE_LENGTH }, (_, step) => ({ x: step * CASCADE_STEP.x, y: step * CASCADE_STEP.y }));
    expect(freeCanvasPosition(desired, taken)).toEqual({ x: CASCADE_COLUMN_GAP, y: 0 });
  });
});
