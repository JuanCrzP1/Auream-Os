import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AutomationFlowCard } from "../../src/features/automations/list/components/AutomationFlowCard";
import { FolderCard } from "../../src/features/automations/list/components/FolderCard";
import type { AutomationSummary } from "@contracts/AutomationContracts";

// ---------------------------------------------------------------------------
// La culebra de luz del borde.
//
// Es UN SOLO TRAZO: un `<rect>` con el perímetro redondeado de la tarjeta, del
// que se enciende un tramo con `stroke-dasharray`. Lo que se fija aquí es
// justamente eso —que siga siendo uno, decorativo y exclusivo de la tarjeta de
// automatización—, no su aspecto: eso se mide en Chrome, que es quien pinta.
// ---------------------------------------------------------------------------

const ruta = "src/features/automations/list/components";
const hoja = readFileSync(`${ruta}/hub-card-flow.css`, "utf8");
const componente = readFileSync(`${ruta}/HubCardFlowTrail.tsx`, "utf8");

const flow: AutomationSummary = {
  id: "id-1",
  key: "k1",
  name: "Mi flujo",
  status: "active",
  updatedAt: "2024-06-15T00:00:00.000Z",
  nodeCount: 3,
  connectionStatus: "connected"
};

function pintarFlujo() {
  return render(
    <MemoryRouter><AutomationFlowCard flow={flow} onRename={() => {}} onDelete={() => {}} /></MemoryRouter>
  );
}

describe("culebra de luz de las tarjetas de automatización", () => {
  it("existe una sola implementación del efecto", () => {
    expect(hoja.match(/@keyframes\s+hub-card-flow/g)).toHaveLength(1);

    for (const otra of ["hub-card.css", "folder-card.css"]) {
      expect(readFileSync(`${ruta}/${otra}`, "utf8")).not.toMatch(/hub-card-flow|@keyframes/);
    }
  });

  it("es UNA sola trayectoria, no dos elementos haciendo de cabeza y cola", () => {
    const { container } = pintarFlujo();
    const svg = container.querySelector(".hub-card-flow")!;

    expect(container.querySelectorAll(".hub-card-flow")).toHaveLength(1);
    expect(svg.querySelectorAll("rect, path, line, polyline, circle")).toHaveLength(1);
    expect(svg.querySelectorAll(".hub-card-flow__trail")).toHaveLength(1);

    // Ni rastro de la solución anterior de dos pseudo-elementos.
    expect(hoja).not.toMatch(/::before/);
    expect(hoja).not.toMatch(/offset-path|offset-distance|offset-rotate|flow-lag|eslab/);
  });

  it("la luz es un tramo del propio trazado, con su longitud normalizada", () => {
    expect(componente).toMatch(/pathLength="100"/);
    expect(hoja).toMatch(/stroke-dasharray:\s*30 70;/);
    expect(hoja).toMatch(/stroke-dashoffset:\s*-100;/);
    expect(hoja).toMatch(/stroke-width:\s*0\.75;/);
  });

  it("la lleva la tarjeta de automatización y NO la carpeta", () => {
    const { container: conFlujo } = pintarFlujo();
    const { container: conCarpeta } = render(<FolderCard folder={{ id: "f1", name: "Carpeta" }} onRename={() => {}} />);

    expect(conFlujo.querySelectorAll(".hub-card-flow")).toHaveLength(1);
    expect(conCarpeta.querySelectorAll(".hub-card-flow")).toHaveLength(0);

    expect(hoja).not.toMatch(/hub-folder-card/);
    expect(readFileSync(`${ruta}/FolderCard.tsx`, "utf8")).not.toMatch(/hub-card-flow/);

    const hojaCarpeta = readFileSync(`${ruta}/folder-card.css`, "utf8");
    for (const prohibido of ["animation", "offset-path", "stroke-dash", "hub-card-flow"]) {
      expect(hojaCarpeta).not.toContain(prohibido);
    }
  });

  it("es decorativa: sin puntero, sin foco y sin nombre accesible", () => {
    const { container } = pintarFlujo();
    const svg = container.querySelector(".hub-card-flow")!;

    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(hoja.slice(hoja.indexOf(".hub-card-flow {"), hoja.indexOf(".hub-card-flow__trail")))
      .toMatch(/pointer-events:\s*none;/);
  });

  it("se retira entera cuando se pide menos movimiento", () => {
    const reduce = hoja.slice(hoja.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduce).toMatch(/\.hub-card-flow\s*\{\s*\n\s*display:\s*none;/);
  });

  it("no añade ningún control interactivo a las tarjetas", () => {
    const { container: conFlujo } = pintarFlujo();
    const { container: conCarpeta } = render(<FolderCard folder={{ id: "f1", name: "Carpeta" }} onRename={() => {}} />);

    // Solo el menú de tres puntos en cada una.
    expect(conFlujo.querySelectorAll("button")).toHaveLength(1);
    expect(conCarpeta.querySelectorAll("button")).toHaveLength(1);
    expect(screen.getByText("Mi flujo")).toBeInTheDocument();
    expect(screen.getByText("Carpeta")).toBeInTheDocument();
  });

  it("las dos tarjetas conservan sus 99px", () => {
    for (const archivo of ["hub-card.css", "folder-card.css"]) {
      expect(readFileSync(`${ruta}/${archivo}`, "utf8"))
        .toMatch(/height:\s*99px;[\s\S]*?min-height:\s*99px;[\s\S]*?max-height:\s*99px;/);
    }
  });
});
