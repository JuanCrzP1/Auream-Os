import { describe, expect, it } from "vitest";
import { listAllTools } from "@features/automations/builder/tools/registry";

// ---------------------------------------------------------------------------
// Cada herramienta debe reconocerse por su color de un vistazo. Se mide la
// distancia perceptual (ΔE CIE76 en CIELAB) entre los colores de cabecera de
// todas las herramientas, y el contraste del texto blanco que va encima.
// ---------------------------------------------------------------------------

/** Distancia mínima aceptada. La pareja aprobada más cercana (Distribuidor–Programador) está en 24,1. */
const MIN_DELTA_E = 24;

/** El título del nodo es blanco y en negrita: contraste mínimo para texto grande. */
const MIN_WHITE_CONTRAST = 3;

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

const linear = (c: number) => (c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92);

function toLab(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map(linear);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function whiteContrast(hex: string): number {
  const [r, g, b] = channels(hex).map(linear);
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

describe("paleta de herramientas", () => {
  const tools = listAllTools();

  it("cada pareja de herramientas se distingue por su color", () => {
    for (let i = 0; i < tools.length; i += 1) {
      for (let j = i + 1; j < tools.length; j += 1) {
        const a = toLab(tools[i].colors.header);
        const b = toLab(tools[j].colors.header);
        const deltaE = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

        expect(deltaE, `${tools[i].type} vs ${tools[j].type}: ΔE ${deltaE.toFixed(1)}`).toBeGreaterThanOrEqual(MIN_DELTA_E);
      }
    }
  });

  it("el título blanco se lee sobre el color de cada herramienta", () => {
    for (const tool of tools) {
      expect(whiteContrast(tool.colors.header), tool.type).toBeGreaterThanOrEqual(MIN_WHITE_CONTRAST);
    }
  });

  it("ningún color de cabecera se repite", () => {
    const headers = tools.map((tool) => tool.colors.header.toLowerCase());
    expect(new Set(headers).size).toBe(headers.length);
  });
});
