import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * El límite mínimo de zoom del lienzo.
 *
 * NO SE RENDERIZA `<ReactFlow>` PARA ESTO: React Flow decide el zoom real a
 * partir de la geometría del contenedor —algo que jsdom no mide—, así que un
 * render no puede confirmar el límite efectivo mejor que leer la prop que se
 * le pasa. Mismo criterio que ya usan las pruebas de `flow-node.css`: la
 * fuente de verdad es el archivo, no un DOM simulado.
 */
describe("el lienzo permite alejarse mucho más que el valor por omisión", () => {
  const fuente = readFileSync(
    "src/features/automations/builder/components/canvas/BuilderCanvas.tsx",
    "utf8"
  );

  it("declara minZoom explícito, por debajo del 0.5 por omisión de React Flow", () => {
    const declarado = /minZoom=\{([\d.]+)\}/.exec(fuente)?.[1];

    expect(declarado).toBeDefined();
    expect(Number(declarado)).toBeLessThan(0.1);
  });

  it("no toca el acercamiento: sin maxZoom propio en el <ReactFlow> interactivo", () => {
    // `fitViewOptions.maxZoom` SÍ existe y es otra cosa —el tope del encuadre
    // inicial—: se excluye para no confundirlo con un `maxZoom` del zoom
    // interactivo, que es justo lo que este test confirma que no se declaró.
    const sinFitView = fuente.replace(/fitViewOptions=\{[^}]*\}/, "");
    expect(sinFitView).not.toMatch(/[^a-zA-Z]maxZoom=/);
  });
});
