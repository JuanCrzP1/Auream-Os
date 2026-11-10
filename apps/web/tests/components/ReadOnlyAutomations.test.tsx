import { describe, expect, it, vi } from "vitest";
import { render, renderHook, screen, within } from "@testing-library/react";
import type { NodeChange } from "@xyflow/react";
import { useReadOnlyBuilder } from "../../src/features/automations/builder/hooks/useReadOnlyBuilder";
import { BuilderEditingProvider } from "../../src/features/automations/builder/context/BuilderEditingContext";
import { NodeExpandedFrame } from "../../src/features/automations/builder/components/canvas/NodeExpandedFrame";
import { resolveTool } from "../../src/features/automations/builder/tools/registry";
import { resolveToolUi } from "../../src/features/automations/builder/tools/ui-registry";
import type { CanvasNode } from "../../src/features/automations/builder/types/canvas";
import { FLOW, renderHub, stubApi } from "../helpers/automationsHub";

// Esta prueba mira la app como alguien SIN `flows.write`.
vi.mock("@shared/auth/tenant/usePermissions", () => ({ useCan: () => false }));

// ---------------------------------------------------------------------------
// Solo lectura (sin `flows.write`, p. ej. el Asesor): el lienzo deja mirar y
// seleccionar, pero ninguna operación cambia el grafo, así que el
// autoguardado nunca tiene nada que escribir.
// ---------------------------------------------------------------------------

function fakeBuilder() {
  return {
    handleNodesChange: vi.fn(),
    handleEdgesChange: vi.fn(),
    handleConnect: vi.fn(),
    handleDropNode: vi.fn(),
    handleUpdateNode: vi.fn(),
    handleDuplicateNode: vi.fn(),
    handleRemoveNode: vi.fn(),
    handleRenameFlow: vi.fn()
  };
}

const CHANGES = [
  { type: "select", id: "n1", selected: true },
  { type: "dimensions", id: "n1", dimensions: { width: 10, height: 10 } },
  { type: "position", id: "n1", position: { x: 5, y: 5 } },
  { type: "remove", id: "n1" }
] as unknown as NodeChange<CanvasNode>[];

describe("useReadOnlyBuilder", () => {
  it("en solo lectura deja seleccionar y medir, e ignora mover, borrar, conectar, soltar, editar y renombrar", () => {
    const builder = fakeBuilder();
    const { result } = renderHook(() => useReadOnlyBuilder(builder as never, true));

    result.current.onNodesChange(CHANGES);
    expect(builder.handleNodesChange).toHaveBeenCalledWith([CHANGES[0], CHANGES[1]]);

    result.current.onConnect({ source: "a", target: "b", sourceHandle: null, targetHandle: null });
    result.current.onDropNode("message" as never, { x: 0, y: 0 });
    result.current.updateNode("n1", {} as never);
    result.current.duplicateNode("n1");
    result.current.removeNode("n1");
    result.current.renameFlow("Otro nombre");
    for (const fn of [builder.handleConnect, builder.handleDropNode, builder.handleUpdateNode, builder.handleDuplicateNode, builder.handleRemoveNode, builder.handleRenameFlow]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it("con permiso de editar, todo pasa tal cual", () => {
    const builder = fakeBuilder();
    const { result } = renderHook(() => useReadOnlyBuilder(builder as never, false));
    expect(result.current.onNodesChange).toBe(builder.handleNodesChange);
    expect(result.current.removeNode).toBe(builder.handleRemoveNode);
  });
});

describe("Solo lectura en la interfaz", () => {
  it("la lista de automatizaciones se ve y se abre, sin «Nueva», sin menú de acciones y sin arrastrar", async () => {
    stubApi({ flows: [FLOW] });
    renderHub();
    const card = (await screen.findByText(FLOW.name)).closest("article")!;
    expect(screen.queryByRole("button", { name: /^Nueva/ })).toBeNull();
    expect(within(card).queryByRole("button", { name: /Acciones para/ })).toBeNull();
    expect(card).toHaveAttribute("draggable", "false");
  });

  it("el editor de un bloque se abre para ver: campos apagados, aviso y «Cerrar» en vez de «Guardar»", () => {
    const data: CanvasNode["data"] = { nodeType: "message", title: "Saludo", preview: "", configSummary: "", isEntry: false, isTerminal: false, content: {}, config: { items: [] }, metadata: {} };
    const noop = () => undefined;
    render(
      <BuilderEditingProvider requestEdit={noop} toggleExpand={noop} updateNode={noop} duplicateNode={noop} removeNode={noop} readOnly>
        <NodeExpandedFrame data={data} tool={resolveTool("message")} ui={resolveToolUi("message")} onCommit={vi.fn()} onClose={vi.fn()} />
      </BuilderEditingProvider>
    );
    expect(screen.getByText(/Solo lectura: tu rol puede ver esta configuración/)).toBeInTheDocument();
    expect(screen.getByRole("group")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });
});
