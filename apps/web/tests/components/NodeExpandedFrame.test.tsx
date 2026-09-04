import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
// NO necesita `ReactFlowProvider`: este marco ya no es un nodo de React Flow
// ni depende de ningún hook suyo —lo monta `ExpandedNodeOverlay`, flotando
// sobre el lienzo—. Es exactamente lo que hace que se pueda probar aislado.
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
  const onCommit = vi.fn();

  const utils = render(
    <NodeExpandedFrame
      data={data}
      tool={resolveTool("message")}
      ui={resolveToolUi("message")}
      onCommit={onCommit}
      onClose={onClose}
    />
  );

  return { ...utils, onClose, onCommit };
}

const guardar = () => screen.getByRole("button", { name: "Guardar" }) as HTMLButtonElement;

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

  it("el cuerpo no deja que un gesto dentro se escape al lienzo", () => {
    const { container } = renderFrame();

    // El marco flota sobre el lienzo de React Flow, que sigue interpretando
    // arrastre y rueda en cualquier punto sin estas clases. Sin ellas,
    // seleccionar texto en un campo movería el lienzo entero.
    expect(container.querySelector(".node-expanded__body")?.className).toContain("nodrag");
    expect(container.querySelector(".node-expanded__body")?.className).toContain("nowheel");
  });
});

// ---------------------------------------------------------------------------
// Editar y confirmar.
//
// Este marco introduce la separación entre EDITAR y GUARDAR:
//
//   editar   → se queda en el borrador local del marco
//   Guardar  → baja al nodo (`onCommit`), y de ahí el autoguardado del lienzo
//              lo persiste como cualquier otro cambio del grafo
//
// El autoguardado NO se toca desde aquí y no aparece en estas pruebas: es de
// `useDraftSync` y tiene las suyas. Que este marco no lo conozca es justo lo
// que mantiene separados los dos conceptos.
//
// Todo lo de abajo se afirma sobre el MARCO, nunca sobre Mensaje: si mañana
// otra herramienta declara editor, hereda este comportamiento sin tocar nada.
// ---------------------------------------------------------------------------

describe("editar y confirmar", () => {
  it("ofrece confirmar y descartar, no una sola salida", () => {
    renderFrame();

    expect(guardar()).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
  });

  it("sin cambios no hay nada que confirmar", () => {
    renderFrame();

    expect(guardar().disabled).toBe(true);
  });

  it("editar NO baja al nodo: se queda en el borrador", () => {
    const { container, onCommit } = renderFrame();

    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));

    // El editor ya muestra el bloque nuevo...
    expect(container.querySelectorAll(".message-item")).toHaveLength(1);
    // ...pero el nodo todavía no se ha enterado. Esta es la línea que separa
    // editar de guardar: antes, cada pulsación escribía en el grafo.
    expect(onCommit).not.toHaveBeenCalled();
    expect(guardar().disabled).toBe(false);
  });

  it("Guardar confirma lo editado, una sola vez y con todo dentro", () => {
    const { onCommit } = renderFrame();

    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));
    fireEvent.click(guardar());

    expect(onCommit).toHaveBeenCalledTimes(1);

    const confirmado = onCommit.mock.calls[0][0];
    expect(confirmado.name).toBe("Saludo inicial");
    expect((confirmado.config.items as unknown[]).length).toBe(1);
    // Confirma configuración y contenido del nodo. Nada de grafo: ni posición,
    // ni conexiones, ni nada del lienzo puede viajar por aquí.
    expect(Object.keys(confirmado).sort()).toEqual(["config", "content", "name"]);
  });

  it("Cancelar cierra sin confirmar nada", () => {
    const { onCommit, onClose } = renderFrame();

    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCommit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cerrar y reabrir conserva lo confirmado", () => {
    const { onCommit, unmount } = renderFrame();

    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));
    fireEvent.click(guardar());
    const confirmado = onCommit.mock.calls[0][0];
    unmount();

    // Reabrir es montar el marco con lo que el nodo tiene ya guardado.
    const reabierto = render(
      <NodeExpandedFrame
        data={{ ...data, content: confirmado.content, config: confirmado.config }}
        tool={resolveTool("message")}
        ui={resolveToolUi("message")}
        onCommit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(reabierto.container.querySelectorAll(".message-item")).toHaveLength(1);
    // Y al reabrir no hay nada pendiente: lo confirmado ya es lo del nodo.
    expect(guardar().disabled).toBe(true);
  });

  it("la barra es del marco, no de Mensaje: cualquier herramienta la hereda", () => {
    // Una herramienta inventada, con un editor que no sabe nada de guardar.
    function EditorAjeno({ draft, onChange }: {
      draft: { config: Record<string, unknown> };
      onChange: (patch: { config: Record<string, unknown> }) => void;
    }) {
      return (
        <button type="button" onClick={() => onChange({ config: { tocado: true } })}>
          Cambiar algo
        </button>
      );
    }

    const onCommit = vi.fn();
    render(
      <NodeExpandedFrame
        data={data}
        tool={resolveTool("message")}
        ui={{ ...resolveToolUi("message"), Editor: EditorAjeno as never }}
        onCommit={onCommit}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cambiar algo" }));
    fireEvent.click(guardar());

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].config).toEqual({ tocado: true });
  });

  it("una herramienta sin editor no ofrece barra de acciones", () => {
    render(
      <NodeExpandedFrame
        data={data}
        tool={resolveTool("message")}
        ui={{ ...resolveToolUi("message"), Editor: undefined }}
        onCommit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Escape con un desplegable delante.
//
// El marco escucha Escape en `window` para cerrarse. El selector de unidades
// de Intervalo escucha Escape en `document`, que va ANTES en el camino del
// evento. Sin detener la propagación, un solo Escape hacía las dos cosas:
// descartaba el menú Y cerraba el editor, perdiendo lo que el usuario llevaba
// escrito sin confirmar. Un gesto natural —cerrar un desplegable— no puede
// tener ese precio.
//
// Se dispara desde el propio control, no desde `window`: es el camino real del
// evento. Lanzarlo directamente sobre `window` se saltaría `document` y este
// test no probaría nada.
// ---------------------------------------------------------------------------

describe("Escape con el selector de unidades abierto", () => {
  /** El marco, con un bloque Intervalo ya colocado. */
  function renderConIntervalo() {
    const onClose = vi.fn();
    const onCommit = vi.fn();

    const utils = render(
      <NodeExpandedFrame
        data={{
          ...data,
          config: { items: [{ id: "i1", kind: "interval", amount: 5, unit: "seconds" }] }
        }}
        tool={resolveTool("message")}
        ui={resolveToolUi("message")}
        onCommit={onCommit}
        onClose={onClose}
      />
    );

    return { ...utils, onClose, onCommit };
  }

  const unidad = () => screen.getByLabelText("Unidad de la pausa del bloque 1");

  it("cierra el menú y NO cierra el editor", () => {
    const { container, onClose } = renderConIntervalo();

    fireEvent.click(unidad());
    expect(screen.getByRole("listbox")).toBeTruthy();

    fireEvent.keyDown(unidad(), { key: "Escape" });

    // El menú se va...
    expect(screen.queryByRole("listbox")).toBeNull();
    // ...y el editor se queda.
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector(".node-expanded")).not.toBeNull();
  });

  it("no pierde lo que el usuario llevaba editado sin confirmar", () => {
    const { onClose, onCommit } = renderConIntervalo();

    // Un cambio local, todavía sin bajar al nodo.
    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));
    expect(guardar().disabled).toBe(false);

    fireEvent.click(unidad());
    fireEvent.keyDown(unidad(), { key: "Escape" });

    // El bloque añadido sigue ahí y sigue pendiente de confirmar.
    // Se busca por su etiqueta y no contando `<li>`: la biblioteca de la
    // izquierda también son elementos de lista y sumaría los suyos.
    expect(screen.getByLabelText("Texto del bloque 2")).toBeTruthy();
    expect(guardar().disabled).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("sin menú abierto, Escape sigue cerrando el editor", () => {
    const { onClose } = renderConIntervalo();

    // La corrección se acota al menú: su manejador solo existe mientras está
    // desplegado, así que el resto del tiempo Escape hace lo de siempre.
    fireEvent.keyDown(unidad(), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("elegir una unidad tampoco cierra el editor", () => {
    const { onClose } = renderConIntervalo();

    fireEvent.click(unidad());
    fireEvent.click(screen.getByRole("option", { name: "minutos" }));

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});
