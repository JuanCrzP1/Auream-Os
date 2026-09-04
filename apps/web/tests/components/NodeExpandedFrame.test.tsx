import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { NodeExpandedFrame } from "@features/automations/builder/components/canvas/NodeExpandedFrame";
import { resolveTool } from "@features/automations/builder/tools/registry";
import { resolveToolUi } from "@features/automations/builder/tools/ui-registry";
import type { CanvasNode } from "@features/automations/builder/types/canvas";

// ---------------------------------------------------------------------------
// Marco del nodo abierto.
//
// Es TRANSVERSAL: lo que se prueba aquí vale para cualquier herramienta que
// declare editor, no solo para Mensaje. Por eso el marco se monta con la UI que
// resuelve el registry, sin nombrar ninguna herramienta en las expectativas.
//
// Necesita el `ReactFlowProvider` porque avisa al lienzo del cambio de tamaño
// —si no lo hiciera, las aristas quedarían apuntando al nodo pequeño—.
// ---------------------------------------------------------------------------

const data: CanvasNode["data"] = {
  nodeType: "message",
  title: "Saludo inicial",
  preview: "",
  configSummary: "",
  isEntry: false,
  isTerminal: false,
  content: {},
  config: { items: [] },
  metadata: {}
};

function renderFrame(onClose = vi.fn()) {
  const onChange = vi.fn();

  const utils = render(
    <ReactFlowProvider>
      <NodeExpandedFrame
        nodeId="n1"
        data={data}
        tool={resolveTool("message")}
        ui={resolveToolUi("message")}
        onChange={onChange}
        onClose={onClose}
      />
    </ReactFlowProvider>
  );

  return { ...utils, onClose, onChange };
}

describe("marco del nodo abierto", () => {
  it("conserva el nombre del nodo en la cabecera", () => {
    renderFrame();

    expect(screen.getByText("Saludo inicial")).toBeTruthy();
  });

  it("monta el editor que declara la herramienta", () => {
    renderFrame();

    expect(screen.getByRole("button", { name: "Añadir Texto" })).toBeTruthy();
  });

  it("cierra con el control de la cabecera", () => {
    const { onClose } = renderFrame();

    fireEvent.click(screen.getByRole("button", { name: /^Cerrar/ }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cierra con Escape", () => {
    const { onClose } = renderFrame();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("no cierra con cualquier otra tecla", () => {
    const { onClose } = renderFrame();

    fireEvent.keyDown(window, { key: "a" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("deja de escuchar Escape al desmontarse", () => {
    const { onClose, unmount } = renderFrame();

    unmount();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("la cabecera es el asa de arrastre, y el cuerpo no arrastra el nodo", () => {
    const { container } = renderFrame();

    // `dragHandle` del nodo apunta a esta clase: si desapareciera, arrastrar
    // dentro de un campo movería el nodo por el lienzo.
    expect(container.querySelector(".node-expanded__header")).not.toBeNull();
    expect(container.querySelector(".node-expanded__body")?.className).toContain("nodrag");
  });
});
