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

  it("Guardar también cierra el editor: confirmar y salir son el mismo gesto", () => {
    // Antes «Guardar» solo llamaba a `onCommit` y el editor se quedaba abierto
    // con los cambios ya persistidos en el nodo — un estado confuso donde
    // guardar parecía no haber hecho nada. Simétrico a «Cancelar», que ya
    // cerraba: la diferencia entre los dos botones es si persisten, no si
    // cierran.
    const { onCommit, onClose } = renderFrame();

    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));
    fireEvent.click(guardar());

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Guardar confirma ANTES de cerrar: el borrador llega completo a onCommit", () => {
    // El orden importa: si cerrara primero, una implementación que derive el
    // borrador del nodo montado perdería los cambios al desmontarse antes de
    // confirmarlos. Se fija con el propio contenido del borrador, no solo con
    // el orden de las llamadas.
    const { onCommit } = renderFrame();

    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));
    fireEvent.click(guardar());

    const confirmado = onCommit.mock.calls[0][0];
    expect((confirmado.config.items as unknown[]).length).toBe(1);
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
        // Una herramienta que no exige nada para guardarse, como las trece que
        // no declaran `validateContent`. Con la de Mensaje, su validación se
        // aplicaría a una configuración que no es la suya.
        tool={{ ...resolveTool("message"), validateContent: undefined }}
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

// ---------------------------------------------------------------------------
// Salir con cambios sin guardar.
//
// Aquí se separan tres gestos que antes eran el mismo `onClose`:
//
//   X / Escape          → INTENTO de salir: pregunta si hay algo sin confirmar
//   Cancelar            → decisión ya tomada de descartar: no pregunta
//   Cerrar sin guardar  → confirmación explícita de ese descarte
//
// La protección es del MARCO. Se prueba con Mensaje por comodidad, pero el
// último bloque la comprueba con un editor inventado: si dependiera de Mensaje,
// ahí se caería.
// ---------------------------------------------------------------------------

const dialogo = () => screen.queryByRole("dialog");
const cerrarEditor = () => screen.getByRole("button", { name: /^Cerrar Saludo inicial/ });
const seguirEditando = () => screen.getByRole("button", { name: "Seguir editando" });
const cerrarSinGuardar = () => screen.getByRole("button", { name: "Cerrar sin guardar" });

/** Un cambio cualquiera, sin nombrar cómo lo hace la herramienta. */
const editarAlgo = () => fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));

describe("protección contra pérdida de cambios", () => {
  it("la X sin cambios cierra directamente, sin preguntar", () => {
    const { onClose } = renderFrame();

    fireEvent.click(cerrarEditor());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialogo()).toBeNull();
  });

  it("la X con cambios no cierra: pide confirmación", () => {
    const { onClose } = renderFrame();

    editarAlgo();
    fireEvent.click(cerrarEditor());

    expect(onClose).not.toHaveBeenCalled();
    expect(dialogo()).not.toBeNull();
    // El editor sigue montado detrás: la decisión se toma viendo lo que está
    // en juego, no sobre una pantalla vacía.
    expect(screen.getByLabelText("Texto del bloque 1")).toBeTruthy();
  });

  it("«Seguir editando» cierra solo el diálogo y no toca el borrador", () => {
    const { onClose, onCommit } = renderFrame();

    editarAlgo();
    fireEvent.click(cerrarEditor());
    fireEvent.click(seguirEditando());

    expect(dialogo()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    // Lo editado sigue ahí, y sigue pendiente de confirmar.
    expect(screen.getByLabelText("Texto del bloque 1")).toBeTruthy();
    expect(guardar().disabled).toBe(false);
  });

  it("«Cerrar sin guardar» cierra el editor y no confirma nada", () => {
    const { onClose, onCommit } = renderFrame();

    editarAlgo();
    fireEvent.click(cerrarEditor());
    fireEvent.click(cerrarSinGuardar());

    expect(onClose).toHaveBeenCalledTimes(1);
    // Descartar es descartar: el nodo se queda con lo último que guardó.
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("Escape sin cambios cierra directamente", () => {
    const { onClose } = renderFrame();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialogo()).toBeNull();
  });

  it("Escape con cambios pide confirmación, igual que la X", () => {
    const { onClose } = renderFrame();

    editarAlgo();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
    expect(dialogo()).not.toBeNull();
  });

  it("Escape con el diálogo abierto cierra SOLO el diálogo", () => {
    // El marco escucha Escape en `window` y el diálogo en `document`, que va
    // antes. Sin detenerlo, el mismo Escape que descarta la confirmación
    // cerraría el editor y se llevaría por delante lo que la confirmación
    // existe para proteger.
    const { onClose } = renderFrame();

    editarAlgo();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(dialogo()).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(dialogo()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Texto del bloque 1")).toBeTruthy();
  });

  it("Guardar confirma y cierra sin pasar por la confirmación", () => {
    const { onClose, onCommit } = renderFrame();

    editarAlgo();
    fireEvent.click(guardar());

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    // Guardar no tiene nada que confirmar: no se pierde nada al salir.
    expect(dialogo()).toBeNull();
  });

  it("Cancelar descarta directamente, sin preguntar", () => {
    // Cancelar YA significa descartar: preguntar otra vez sería preguntar dos
    // veces por la misma decisión.
    const { onClose, onCommit } = renderFrame();

    editarAlgo();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
    expect(dialogo()).toBeNull();
  });

  it("el diálogo se anuncia como tal y lleva el foco a la salida que no destruye", () => {
    renderFrame();

    editarAlgo();
    fireEvent.click(cerrarEditor());

    const caja = dialogo()!;
    expect(caja.getAttribute("aria-modal")).toBe("true");
    // Confirmar con Enter sin leer deja al usuario editando, nunca borrando.
    expect(document.activeElement).toBe(seguirEditando());
  });

  it("la protección es del marco: una herramienta inventada la hereda igual", () => {
    // Ni una línea de esto vive en Mensaje. Si la guarda dependiera de su
    // editor, este bloque se caería.
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

    const onClose = vi.fn();
    const onCommit = vi.fn();
    render(
      <NodeExpandedFrame
        data={data}
        tool={resolveTool("message")}
        ui={{ ...resolveToolUi("message"), Editor: EditorAjeno as never }}
        onCommit={onCommit}
        onClose={onClose}
      />
    );

    // Sin tocar nada, la X cierra sin preguntar.
    fireEvent.click(cerrarEditor());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialogo()).toBeNull();

    // Con un cambio suyo, la misma X pregunta.
    fireEvent.click(screen.getByRole("button", { name: "Cambiar algo" }));
    fireEvent.click(cerrarEditor());
    expect(dialogo()).not.toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(cerrarSinGuardar());
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onCommit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Guardar exige que haya algo que enviar.
//
// La decisión NO se toma aquí: la declara la herramienta (`validateContent`) y
// este marco solo la consulta y la hace cumplir. Por eso las trece
// herramientas que no declaran nada siguen guardándose siempre.
// ---------------------------------------------------------------------------

describe("el marco hace cumplir la validez que declara la herramienta", () => {
  const conConfig = (items: ReadonlyArray<Record<string, unknown>>) => {
    const onCommit = vi.fn();
    const onClose = vi.fn();
    const utils = render(
      <NodeExpandedFrame
        data={{ ...data, config: { items } }}
        tool={resolveTool("message")}
        ui={resolveToolUi("message")}
        onCommit={onCommit}
        onClose={onClose}
      />
    );
    return { ...utils, onCommit, onClose };
  };

  it("sin contenido: Guardar ni confirma ni cierra, y dice por qué", () => {
    const { onCommit, onClose } = conConfig([
      { id: "p", kind: "interval", amount: 5, unit: "seconds" }
    ]);

    // Un cambio para habilitar el botón, sin añadir contenido.
    fireEvent.change(screen.getByLabelText("Duración de la pausa del bloque 1"), {
      target: { value: "9" }
    });
    fireEvent.click(guardar());

    expect(onCommit).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(
      "Agrega al menos un contenido para enviar antes de guardar."
    );
  });

  it("medio sin fuente: el aviso es específico, no genérico", () => {
    const { onCommit } = conConfig([
      { id: "m", kind: "image", url: "", caption: "", sendOnce: false }
    ]);

    fireEvent.change(screen.getByLabelText(/^Descripción/), { target: { value: "x" } });
    fireEvent.click(guardar());

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(
      "Completa el archivo o el enlace de tu contenido antes de guardar."
    );
  });

  it("el aviso no aparece hasta que se intenta guardar", () => {
    conConfig([{ id: "p", kind: "interval", amount: 5, unit: "seconds" }]);

    // Mientras construye no se le regaña por no haber terminado.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("el aviso se retira en cuanto lo que hay ya vale", () => {
    const { onCommit, onClose } = conConfig([
      { id: "p", kind: "interval", amount: 5, unit: "seconds" }
    ]);

    fireEvent.change(screen.getByLabelText("Duración de la pausa del bloque 1"), {
      target: { value: "9" }
    });
    fireEvent.click(guardar());
    expect(screen.getByRole("alert")).toBeTruthy();

    // Se añade contenido de verdad: el aviso desaparece y Guardar funciona.
    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.click(guardar());
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("con contenido válido, Guardar sigue funcionando igual que siempre", () => {
    const { onCommit, onClose } = conConfig([
      { id: "m", kind: "image", url: "https://cdn.test/f.png", caption: "", sendOnce: false }
    ]);

    fireEvent.change(screen.getByLabelText(/^Descripción/), { target: { value: "Playa" } });
    fireEvent.click(guardar());

    expect(screen.queryByRole("alert")).toBeNull();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
