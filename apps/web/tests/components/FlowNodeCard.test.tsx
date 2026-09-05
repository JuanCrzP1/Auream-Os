import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { createElement } from "react";
import { ReactFlowProvider, type NodeProps } from "@xyflow/react";
import { FlowNodeCard } from "@features/automations/builder/components/canvas/FlowNodeCard";
import { BuilderEditingProvider } from "@features/automations/builder/context/BuilderEditingContext";
import { createNodeDraft } from "@features/automations/builder/services/createNodeDraft";
import { listAllTools, resolveTool } from "@features/automations/builder/tools/registry";
import { resolveToolUi } from "@features/automations/builder/tools/ui-registry";
import type { CanvasNode } from "@features/automations/builder/types/canvas";

// ---------------------------------------------------------------------------
// Icono del nodo cerrado en el lienzo.
//
// `FlowNodeCard` pintaba `tool.glyph` —un emoji suelto de `registry.ts`— en
// lugar del SVG oficial que ya declara cada herramienta en `ui-registry.tsx` y
// que la paleta y el nodo expandido ya consumían. Estos tests fijan que el
// nodo cerrado pasa a resolver el MISMO catálogo visual, por tipo, sin ningún
// caso especial por herramienta.
//
// La garantía de que cada tipo TIENE un `Icon` que renderiza algo ya la cubre
// `toolUiRegistry.test.tsx`: no se duplica aquí. Lo que se fija en este
// archivo es la CONEXIÓN entre `FlowNodeCard` y ese catálogo, no el contenido
// de cada icono.
// ---------------------------------------------------------------------------

function montar(node: CanvasNode, selected = false) {
  return render(
    <ReactFlowProvider>
      <BuilderEditingProvider
        requestEdit={vi.fn()}
        toggleExpand={vi.fn()}
        updateNode={vi.fn()}
        duplicateNode={vi.fn()}
        removeNode={vi.fn()}
      >
        <FlowNodeCard
          {...({ id: node.id, data: node.data, selected } as NodeProps<CanvasNode>)}
        />
      </BuilderEditingProvider>
    </ReactFlowProvider>
  );
}

/** Icono renderizado en la cabecera del nodo cerrado, aislado del resto de la tarjeta. */
function iconoDeCabecera(container: HTMLElement) {
  return container.querySelector(".flow-node__type-icon");
}

describe("FlowNodeCard — icono del nodo cerrado", () => {
  it("Mensaje renderiza su SVG oficial, no un glifo de texto", () => {
    const nodo = createNodeDraft("message", 0);
    const { container } = montar(nodo);

    const icono = iconoDeCabecera(container);
    expect(icono?.querySelector("svg")).not.toBeNull();
    expect(icono?.textContent).toBe("");
  });

  it("Esperar respuesta ('question') renderiza su SVG oficial, no un glifo de texto", () => {
    const nodo = createNodeDraft("question", 0);
    const { container } = montar(nodo);

    const icono = iconoDeCabecera(container);
    expect(icono?.querySelector("svg")).not.toBeNull();
    expect(icono?.textContent).toBe("");
  });

  it("el mecanismo es genérico: cada herramienta del catálogo pinta EXACTAMENTE su propio SVG, sin casos especiales", () => {
    // Recorre las 13 herramientas de la paleta más el nodo de sistema `end`,
    // sin nombrar ninguna: si `FlowNodeCard` tuviera un `tool === "message" ?
    // ... : ...` esto lo dejaría en evidencia para cualquier tipo que no fuera
    // Mensaje, no solo para uno.
    for (const tool of listAllTools()) {
      const nodo = createNodeDraft(tool.type, 0);
      const { container, unmount } = montar(nodo);

      // Referencia independiente: lo que `ui-registry` dice que ES el icono
      // oficial de este tipo, renderizado por su cuenta.
      const referencia = render(createElement(resolveToolUi(tool.type).Icon));

      const iconoEnNodo = iconoDeCabecera(container)?.querySelector("svg");
      const iconoReferencia = referencia.container.querySelector("svg");

      expect(iconoEnNodo, `'${tool.type}' no pinta ningún SVG`).not.toBeNull();
      expect(
        iconoEnNodo?.outerHTML,
        `'${tool.type}' no coincide con su icono oficial de ui-registry`
      ).toBe(iconoReferencia?.outerHTML);

      referencia.unmount();
      unmount();
    }
  });

  it("no se renderiza el glyph de ToolDefinition para ninguna herramienta", () => {
    for (const tool of listAllTools()) {
      const nodo = createNodeDraft(tool.type, 0);
      const { container, unmount } = montar(nodo);

      const glyph = resolveTool(tool.type).glyph;
      expect(
        iconoDeCabecera(container)?.textContent,
        `'${tool.type}' sigue mostrando su glyph ('${glyph}') en vez del SVG`
      ).not.toBe(glyph);

      unmount();
    }
  });

  it("Inicio (isEntry) sigue mostrando su propio SVG, ajeno al catálogo de herramientas", () => {
    const nodo = createNodeDraft("message", 0);
    nodo.data = { ...nodo.data, isEntry: true };

    const { container } = montar(nodo);

    // La píldora de entrada no pasa por `.flow-node__type-icon`: es un marco
    // completamente distinto, con su propio chip.
    expect(iconoDeCabecera(container)).toBeNull();
    const chip = container.querySelector(".flow-node__entry-chip svg");
    expect(chip).not.toBeNull();
    expect(chip?.querySelector("polygon")?.getAttribute("points")).toBe("3,2 13,8 3,14");
  });

  it("los estados de selección no rompen el renderizado del icono", () => {
    const nodo = createNodeDraft("distributor", 0);

    const sinSeleccionar = montar(nodo, false);
    expect(iconoDeCabecera(sinSeleccionar.container)?.querySelector("svg")).not.toBeNull();
    sinSeleccionar.unmount();

    const seleccionado = montar(nodo, true);
    expect(iconoDeCabecera(seleccionado.container)?.querySelector("svg")).not.toBeNull();
    seleccionado.unmount();
  });
});
