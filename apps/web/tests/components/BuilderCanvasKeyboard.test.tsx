import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { BuilderCanvas } from "@features/automations/builder/components/canvas/BuilderCanvas";
import { BuilderEditingProvider } from "@features/automations/builder/context/BuilderEditingContext";
import { createNodeDraft } from "@features/automations/builder/services/createNodeDraft";

// ---------------------------------------------------------------------------
// Teclado en el lienzo (B13): con un bloque enfocado, Enter abre su editor.
// ---------------------------------------------------------------------------

// jsdom no implementa ResizeObserver; React Flow lo usa para medir bloques.
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

function mount(onEditNode = vi.fn()) {
  const node = createNodeDraft("message", 0);
  const noop = vi.fn();
  const utils = render(
    <BuilderEditingProvider requestEdit={noop} toggleExpand={noop} updateNode={noop} duplicateNode={noop} removeNode={noop}>
      <div style={{ width: 800, height: 600 }}>
        <BuilderCanvas
          nodes={[node]}
          edges={[]}
          onNodesChange={noop}
          onEdgesChange={noop}
          onConnect={noop}
          onSelectNode={noop}
          onSelectEdge={noop}
          onEditNode={onEditNode}
          onDropNode={noop}
          onPaneClick={noop}
          review={{ issues: [], errorCount: 0, warningCount: 0 }}
        />
      </div>
    </BuilderEditingProvider>
  );
  const wrapper = utils.container.querySelector<HTMLElement>(`.react-flow__node[data-id="${node.id}"]`);
  return { ...utils, node, wrapper, onEditNode };
}

describe("lienzo — teclado", () => {
  it("el lienzo tiene un nombre que explica cómo usarlo con teclado", () => {
    const { container } = mount();
    expect(container.querySelector(".react-flow")?.getAttribute("aria-label")).toMatch(/Enter abre el editor/);
  });

  it("Enter sobre un bloque enfocado abre su editor", () => {
    const { wrapper, node, onEditNode } = mount();
    expect(wrapper).not.toBeNull();

    fireEvent.keyDown(wrapper!, { key: "Enter" });
    expect(onEditNode).toHaveBeenCalledWith(node.id);
  });

  it("Enter dentro de un control del bloque no lo abre (lo maneja ese control)", () => {
    const { wrapper, onEditNode } = mount();
    const inner = wrapper!.querySelector("button");

    fireEvent.keyDown(inner!, { key: "Enter" });
    expect(onEditNode).not.toHaveBeenCalled();
  });
});
