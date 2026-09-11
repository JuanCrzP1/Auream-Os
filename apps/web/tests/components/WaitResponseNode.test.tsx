import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ReactFlowProvider, type NodeProps } from "@xyflow/react";
import { NodeExpandedFrame } from "@features/automations/builder/components/canvas/NodeExpandedFrame";
import { FlowNodeCard } from "@features/automations/builder/components/canvas/FlowNodeCard";
import { BuilderEditingProvider } from "@features/automations/builder/context/BuilderEditingContext";
import { applyNodePatch } from "@features/automations/builder/services/applyNodePatch";
import { createNodeDraft } from "@features/automations/builder/services/createNodeDraft";
import { resolveTool } from "@features/automations/builder/tools/registry";
import { resolveToolUi } from "@features/automations/builder/tools/ui-registry";
import { readWaitResponseConfig } from "@contracts/WaitResponseConfig";
import {
  SALIDA_RESPUESTA,
  SALIDA_TIEMPO_AGOTADO,
  SIN_MENSAJE_PREVIO
} from "@features/automations/builder/tools/wait-response/WaitResponseCompactBody";
import type { CanvasNode } from "@features/automations/builder/types/canvas";
import type { NodeType } from "@contracts/FlowSnapshot";

// ---------------------------------------------------------------------------
// «Esperar respuesta» dentro del Builder, por el camino real.
//
// No se monta el editor suelto —eso ya está cubierto— sino el MARCO GENÉRICO
// que lo contiene, el mismo que usa Mensaje: `NodeExpandedFrame`. Lo que se
// prueba aquí es la costura: que Guardar confirme, que Cancelar descarte, que
// la X con cambios pendientes pregunte y que lo confirmado sobreviva a cerrar y
// reabrir pasando por `applyNodePatch`, que es el único camino de escritura.
//
// Si alguien construyera un modal propio para esta herramienta, este archivo
// dejaría de tener sentido: está escrito contra la infraestructura compartida a
// propósito.
// ---------------------------------------------------------------------------

function nodoEspera(): CanvasNode {
  return createNodeDraft("question", 0);
}

/**
 * Marco real gobernando un nodo real: `onCommit` aplica el parche con
 * `applyNodePatch` y el nodo resultante vuelve a entrar al marco, igual que
 * hace el lienzo.
 */
function MarcoGobernado({
  inicial,
  onCerrar
}: {
  readonly inicial: CanvasNode;
  readonly onCerrar?: () => void;
}) {
  const [nodo, setNodo] = useState(inicial);
  const [abierto, setAbierto] = useState(true);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)}>
        reabrir
      </button>
    );
  }

  return (
    <NodeExpandedFrame
      data={nodo.data}
      tool={resolveTool(nodo.data.nodeType)}
      ui={resolveToolUi(nodo.data.nodeType)}
      onCommit={(patch) => setNodo((previo) => applyNodePatch(previo, patch))}
      onClose={() => {
        setAbierto(false);
        onCerrar?.();
      }}
    />
  );
}

/**
 * Pinta la tarjeta cerrada de CUALQUIER herramienta dentro del lienzo, para
 * poder comparar unas con otras. Devuelve el contenedor.
 */
function pintarNodo(tipo: NodeType, parche: Parameters<typeof applyNodePatch>[1]): HTMLElement {
  const nodo = applyNodePatch(createNodeDraft(tipo, 0), parche);
  const props = { id: nodo.id, data: nodo.data, selected: false } as unknown as NodeProps<CanvasNode>;

  return render(
    <ReactFlowProvider>
      <BuilderEditingProvider
        requestEdit={vi.fn()}
        toggleExpand={vi.fn()}
        updateNode={vi.fn()}
        duplicateNode={vi.fn()}
        removeNode={vi.fn()}
      >
        <FlowNodeCard {...props} />
      </BuilderEditingProvider>
    </ReactFlowProvider>
  ).container;
}

function escribirMensaje(texto: string) {
  fireEvent.change(screen.getByLabelText("Mensaje antes de esperar"), { target: { value: texto } });
}

describe("creación del nodo", () => {
  it("nace con «sin límite» apagado y 30 minutos de tiempo máximo", () => {
    // Decisión de producto: el editor de un nodo recién creado debe mostrarse
    // así, sin que el usuario tenga que tocar nada. No es «lo que el motor
    // ejecuta hoy» —el timeout todavía no vence, ver `QuestionNodeHandler`—:
    // es el estado inicial que se pide ver en pantalla.
    const nodo = nodoEspera();

    expect(nodo.data.nodeType).toBe("question");
    expect(nodo.data.title).toBe("Esperar respuesta");
    expect(readWaitResponseConfig(nodo.data.config)).toEqual({
      waitIndefinitely: false,
      timeout: { amount: 30, unit: "minutes" },
      groupMessages: false,
      replyToInbound: false
    });
  });

  it("nace sin mensaje previo: el texto es opcional", () => {
    expect(nodoEspera().data.content).toEqual({});
  });

  it("dos nodos no comparten configuración", () => {
    // `createNodeDraft` clona en profundidad; sin eso, editar uno editaría el
    // otro y también la propia definición de la herramienta.
    const uno = nodoEspera();
    const otro = nodoEspera();

    expect(uno.data.config).not.toBe(otro.data.config);
  });
});

describe("el marco genérico, no uno propio", () => {
  it("usa el mismo marco, cabecera y barra de acciones que cualquier herramienta", () => {
    render(<MarcoGobernado inicial={nodoEspera()} />);

    expect(document.querySelector(".node-expanded")).not.toBeNull();
    expect(document.querySelector(".node-expanded__header")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Guardar" })).toHaveClass("toolbar-button");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cerrar/ })).toBeInTheDocument();
  });

  it("la cabecera lleva el dorado de la herramienta", () => {
    render(<MarcoGobernado inicial={nodoEspera()} />);

    const cabecera = document.querySelector<HTMLElement>(".node-expanded__header");

    // Mismo valor que declara `definition.ts`, en RGB tal y como lo normaliza el
    // navegador. Es la identidad dorada, no el naranja que tenía antes.
    expect(cabecera?.style.background).toBe("rgb(212, 167, 44)");
  });

  it("Guardar nace deshabilitado: sin cambios no hay nada que confirmar", () => {
    render(<MarcoGobernado inicial={nodoEspera()} />);

    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });
});

describe("Guardar", () => {
  it("confirma lo editado en el nodo y cierra", () => {
    const alCerrar = vi.fn();
    render(<MarcoGobernado inicial={nodoEspera()} onCerrar={alCerrar} />);

    escribirMensaje("¿En qué ciudad te encuentras?");
    fireEvent.change(screen.getByLabelText("Guardar respuesta en"), { target: { value: "ciudad" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(alCerrar).toHaveBeenCalled();
  });

  it("lo guardado sobrevive a cerrar y volver a abrir", () => {
    render(<MarcoGobernado inicial={nodoEspera()} />);

    // El tiempo máximo ya está activo desde que se crea el nodo: no hace falta
    // apagar «sin límite» para llegar a él.
    escribirMensaje("¿Cuál es tu correo?");
    fireEvent.click(screen.getByRole("radio", { name: "Horas" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    fireEvent.click(screen.getByRole("button", { name: "reabrir" }));

    expect(screen.getByLabelText("Mensaje antes de esperar")).toHaveValue("¿Cuál es tu correo?");
    expect(screen.getByLabelText("Tiempo máximo")).toHaveValue(30);
    expect(screen.getByRole("radio", { name: "Horas" })).toHaveAttribute("aria-checked", "true");
  });

  it("no guarda una configuración contradictoria: avisa y no cierra", () => {
    // «Sin límite» encendido con un tiempo máximo guardado. El marco pregunta a
    // `validateContent` de la herramienta, sin saber de qué herramienta se trata.
    const nodo = applyNodePatch(nodoEspera(), {
      config: { waitIndefinitely: true, timeout: { amount: 30, unit: "minutes" } }
    });
    const alCerrar = vi.fn();
    render(<MarcoGobernado inicial={nodo} onCerrar={alCerrar} />);

    escribirMensaje("algo, para que haya cambios que guardar");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/Esperar sin límite/);
    expect(alCerrar).not.toHaveBeenCalled();
  });

  it("no guarda un destino que el contexto no podría resolver", () => {
    const alCerrar = vi.fn();
    render(<MarcoGobernado inicial={nodoEspera()} onCerrar={alCerrar} />);

    fireEvent.change(screen.getByLabelText("Guardar respuesta en"), {
      target: { value: "mi ciudad" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(alCerrar).not.toHaveBeenCalled();
  });
});

describe("Cancelar y cerrar con la X", () => {
  it("Cancelar descarta sin preguntar y lo editado no persiste", () => {
    render(<MarcoGobernado inicial={nodoEspera()} />);

    escribirMensaje("esto se tira");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "reabrir" }));

    expect(screen.getByLabelText("Mensaje antes de esperar")).toHaveValue("");
  });

  it("la X con cambios sin guardar PREGUNTA antes de salir", () => {
    render(<MarcoGobernado inicial={nodoEspera()} />);

    escribirMensaje("a medio escribir");
    fireEvent.click(screen.getByRole("button", { name: /Cerrar/ }));

    // El diálogo del marco, heredado sin escribir una línea en la herramienta.
    expect(document.querySelector(".node-expanded__guard")).not.toBeNull();
    // Y no ha cerrado: el editor sigue ahí detrás.
    expect(screen.getByLabelText("Mensaje antes de esperar")).toHaveValue("a medio escribir");
  });

  it("la X sin cambios cierra directamente", () => {
    const alCerrar = vi.fn();
    render(<MarcoGobernado inicial={nodoEspera()} onCerrar={alCerrar} />);

    fireEvent.click(screen.getByRole("button", { name: /Cerrar/ }));

    expect(alCerrar).toHaveBeenCalled();
    expect(document.querySelector(".node-expanded__guard")).toBeNull();
  });
});

describe("el nodo cerrado en el lienzo", () => {
  function pintarTarjeta(nodo: CanvasNode) {
    const props = {
      id: nodo.id,
      data: nodo.data,
      selected: false
    } as unknown as NodeProps<CanvasNode>;

    return render(
      <ReactFlowProvider>
        <BuilderEditingProvider
          requestEdit={vi.fn()}
          toggleExpand={vi.fn()}
          updateNode={vi.fn()}
          duplicateNode={vi.fn()}
          removeNode={vi.fn()}
        >
          <FlowNodeCard {...props} />
        </BuilderEditingProvider>
      </ReactFlowProvider>
    );
  }

  it("sin mensaje propio dice qué está haciendo, no se queda mudo", () => {
    const { container } = pintarTarjeta(nodoEspera());

    expect(within(container).getByText(SIN_MENSAJE_PREVIO)).toBeInTheDocument();
    // El default del nodo recién creado es 30 minutos, no «Sin límite».
    expect(within(container).getByText("Máximo: 30 minutos")).toBeInTheDocument();
  });

  it("enseña la pregunta, la espera y el campo destino", () => {
    const nodo = applyNodePatch(nodoEspera(), {
      content: { text: "¿En qué ciudad te encuentras?" },
      config: {
        waitIndefinitely: false,
        timeout: { amount: 30, unit: "minutes" },
        targetKey: "ciudad"
      }
    });

    const { container } = pintarTarjeta(nodo);

    expect(within(container).getByText("¿En qué ciudad te encuentras?")).toBeInTheDocument();
    expect(within(container).getByText("Máximo: 30 minutos")).toBeInTheDocument();
    // El destino, en su propio hueco del pie de la espera —no confundirlo con
    // la palabra «ciudad» que también aparece dentro de la pregunta—.
    expect(container.querySelector(".wr-node__target")).toHaveTextContent("ciudad");
  });

  it("enseña la clave normalizada, nunca el prefijo técnico", () => {
    const nodo = applyNodePatch(nodoEspera(), {
      config: { waitIndefinitely: true, targetKey: "context.ciudad" }
    });

    const { container } = pintarTarjeta(nodo);

    expect(container.querySelector(".wr-node__target")).toHaveTextContent("ciudad");
    expect(container.textContent).not.toContain("context.");
  });

  // -------------------------------------------------------------------------
  // LAS DOS SALIDAS.
  //
  // Se comprueban como HANDLES REALES de React Flow, no como puntos dibujados:
  // se busca por `.react-flow__handle` con `data-handleid`, que es lo que React
  // Flow escribe en el DOM y lo que usa para resolver de qué punto arranca una
  // arista. Un `<div>` decorativo no aparecería en esta consulta.
  // -------------------------------------------------------------------------

  function salidas(container: HTMLElement) {
    return [
      ...container.querySelectorAll<HTMLElement>(
        '.react-flow__handle[data-handlepos="right"][data-handleid]'
      )
    ].map((handle) => handle.getAttribute("data-handleid"));
  }

  it("con tiempo máximo ofrece DOS salidas: Respuesta y Tiempo agotado", () => {
    const nodo = applyNodePatch(nodoEspera(), {
      config: { waitIndefinitely: false, timeout: { amount: 30, unit: "minutes" } }
    });

    const { container } = pintarTarjeta(nodo);

    expect(within(container).getByText("Respuesta")).toBeInTheDocument();
    expect(within(container).getByText("Tiempo agotado")).toBeInTheDocument();
    expect(salidas(container)).toEqual([SALIDA_RESPUESTA, SALIDA_TIEMPO_AGOTADO]);
  });

  it("con «sin límite» solo ofrece Respuesta: no se pinta un camino imposible", () => {
    // Sin vencimiento no hay «tiempo agotado» que pueda ocurrir, así que no se
    // ofrece la salida. Es la semántica que ya tiene el contrato.
    const nodo = applyNodePatch(nodoEspera(), {
      config: { waitIndefinitely: true, timeout: undefined }
    });

    const { container } = pintarTarjeta(nodo);

    expect(within(container).getByText("Respuesta")).toBeInTheDocument();
    expect(within(container).queryByText("Tiempo agotado")).not.toBeInTheDocument();
    expect(salidas(container)).toEqual([SALIDA_RESPUESTA]);
  });

  it("las dos salidas son handles de ORIGEN, conectables y en filas distintas", () => {
    const nodo = applyNodePatch(nodoEspera(), {
      config: { waitIndefinitely: false, timeout: { amount: 2, unit: "hours" } }
    });

    const { container } = pintarTarjeta(nodo);
    const handles = [
      ...container.querySelectorAll<HTMLElement>(".wr-out__handle.react-flow__handle")
    ];

    expect(handles).toHaveLength(2);

    for (const handle of handles) {
      // De origen: de aquí se tira una conexión.
      expect(handle.className).toContain("source");
      // Conectable: React Flow lo marca así cuando puede iniciar/recibir.
      expect(handle.className).toContain("connectable");
    }

    // Y cada una vive en SU fila, no las dos en el mismo punto: el ancla es la
    // fila (`.wr-out`), así que no pueden solaparse.
    const filas = handles.map((handle) => handle.closest(".wr-out"));
    expect(filas[0]).not.toBe(filas[1]);
    expect(filas[0]).not.toBeNull();
    expect(filas[1]).not.toBeNull();
  });

  it("el cascarón NO añade su salida genérica cuando la herramienta trae las suyas", () => {
    // Sin esto habría una tercera salida anónima en el borde, sin rótulo y sin
    // significado. `ownsOutputs` es lo que hace que `FlowNodeCard` se aparte.
    //
    // Se comprueba por PERTENENCIA y no por ausencia de la clase: las salidas
    // propias llevan las mismas clases del Builder que la genérica —para
    // compartir su estilo—, así que lo que hay que fijar es que TODA salida de
    // este nodo viva dentro de una fila de resultados. Una suelta a nivel del
    // cascarón no estaría en ninguna.
    const { container } = pintarTarjeta(nodoEspera());

    const salidas = [...container.querySelectorAll(".flow-node__handle--source")];
    expect(salidas).toHaveLength(2);
    for (const salida of salidas) {
      expect(salida.closest(".wr-out")).not.toBeNull();
    }

    // La ENTRADA sigue siendo del cascarón: recibir conexiones es igual para
    // todas las herramientas y ninguna lo decide.
    expect(container.querySelector(".flow-node__handle--target")).not.toBeNull();
  });

  it("las salidas comparten la identidad visual del handle del Builder", () => {
    // El ajuste: no se declara ni tamaño, ni color, ni borde propios. Llevan las
    // mismas clases que el handle de ENTRADA que pone el cascarón, de modo que
    // los tres se ven iguales. Si alguien volviera a darles un estilo propio,
    // dejarían de compartir estas clases o aparecería una regla de tamaño en la
    // hoja de la herramienta —lo segundo lo vigila el test de la hoja—.
    const { container } = pintarTarjeta(nodoEspera());

    const entrada = container.querySelector(".flow-node__handle--target");
    const salidas = [...container.querySelectorAll(".flow-node__handle--source")];

    expect(entrada).not.toBeNull();
    for (const salida of salidas) {
      // Misma familia de clases del Builder que la entrada.
      expect(salida.classList.contains("flow-node__handle")).toBe(true);
      expect(entrada?.classList.contains("flow-node__handle")).toBe(true);
      // Y el mismo componente de React Flow por debajo.
      expect(salida.classList.contains("react-flow__handle")).toBe(true);
    }
  });

  it("la hoja de la herramienta no le da a sus handles tamaño ni color propios", () => {
    // Guarda del ajuste, leída de la hoja: lo único que puede declarar sobre un
    // handle es su COLOCACIÓN. Tamaño, fondo o borde propios volverían a
    // separarlo de la familia del Builder.
    const hoja = readFileSync(
      "src/features/automations/builder/tools/wait-response/wait-response-editor.css",
      "utf8"
    );

    const reglas = [...hoja.matchAll(/\.wr-out__handle[^{]*\{([^}]*)\}/g)].map(([, cuerpo]) => cuerpo);
    expect(reglas.length).toBeGreaterThan(0);

    for (const cuerpo of reglas) {
      expect(cuerpo).not.toMatch(/(^|;|\s)(width|height|background|border|box-shadow)\s*:/);
    }
  });

  it("cada salida lleva su tono, para distinguirlas sin leer el rótulo", () => {
    // Las clases se componen en plantilla (`wr-out--${tono}`), así que un
    // cambio de nombre no lo detectaría ningún typo del compilador: si dejaran
    // de coincidir con la hoja, las dos salidas se verían idénticas y en
    // silencio.
    const nodo = applyNodePatch(nodoEspera(), {
      config: { waitIndefinitely: false, timeout: { amount: 30, unit: "minutes" } }
    });

    const { container } = pintarTarjeta(nodo);

    expect(container.querySelector(".wr-out--respuesta")).not.toBeNull();
    expect(container.querySelector(".wr-out--tiempo")).not.toBeNull();
  });

  it("la zona de resultados está separada del contenido", () => {
    const { container } = pintarTarjeta(nodoEspera());

    const zona = container.querySelector(".wr-node__outputs");
    expect(zona).not.toBeNull();
    // Las salidas viven DENTRO de esa zona, no sueltas entre el contenido.
    expect(zona?.querySelectorAll(".wr-out")).toHaveLength(2);
    // Y el contenido —pregunta y espera— queda fuera de ella.
    expect(zona?.querySelector(".wr-node__prompt")).toBeNull();
    expect(zona?.querySelector(".wr-node__wait")).toBeNull();
  });

  it("cada salida es una mini tarjeta propia, y el handle sigue fuera de ella", () => {
    // La tarjeta envuelve el punto y el rótulo; el handle sigue siendo hijo
    // directo de `.wr-out` —el ancla de siempre—, no de `.wr-out__card`. Es la
    // comprobación de que envolver el contenido en una superficie visual no
    // movió el handle de sitio en el árbol.
    const nodo = applyNodePatch(nodoEspera(), {
      config: { waitIndefinitely: false, timeout: { amount: 30, unit: "minutes" } }
    });

    const { container } = pintarTarjeta(nodo);
    const filas = [...container.querySelectorAll(".wr-out")];
    expect(filas).toHaveLength(2);

    for (const fila of filas) {
      const tarjeta = fila.querySelector(":scope > .wr-out__card");
      expect(tarjeta).not.toBeNull();
      expect(tarjeta?.querySelector(".wr-out__dot")).not.toBeNull();
      expect(tarjeta?.querySelector(".wr-out__label")).not.toBeNull();

      // El handle es hijo DIRECTO de la fila, hermano de la tarjeta —no está
      // dentro de ella—.
      const handle = fila.querySelector(":scope > .wr-out__handle");
      expect(handle).not.toBeNull();
      expect(tarjeta?.contains(handle)).toBe(false);
    }
  });

  it("el indicador dentro de la tarjeta usa los mismos tokens semánticos que el handle", () => {
    const hoja = readFileSync(
      "src/features/automations/builder/tools/wait-response/wait-response-editor.css",
      "utf8"
    );

    expect(hoja).toMatch(/\.wr-out--respuesta \.wr-out__dot\s*\{[^}]*background:\s*var\(--status-success\)/);
    expect(hoja).toMatch(/\.wr-out--tiempo \.wr-out__dot\s*\{[^}]*background:\s*var\(--status-danger\)/);
  });

  it("NO enumera agrupar, citar ni reaccionar: la tarjeta es un resumen", () => {
    const nodo = applyNodePatch(nodoEspera(), {
      config: { waitIndefinitely: true, groupMessages: true, replyToInbound: true, reaction: "👍" }
    });

    const { container } = pintarTarjeta(nodo);

    expect(container.textContent).not.toMatch(/agrupar|citar|reacc|👍/i);
  });

  it("publica el dorado de la herramienta al lienzo", () => {
    const { container } = pintarTarjeta(nodoEspera());
    const tarjeta = container.querySelector<HTMLElement>(".flow-node");

    expect(tarjeta?.style.getPropertyValue("--flow-node-accent")).toBe("#d4a72c");
    expect(tarjeta?.style.getPropertyValue("--flow-node-surface")).toBe("#8a6418");
  });

  it("no recibe el tratamiento de cristal de Mensaje", () => {
    // Ese está acotado por `:has(.flow-node__blocks)`, que es la secuencia de
    // Mensaje. Esta tarjeta no la tiene y por tanto no lo hereda.
    const { container } = pintarTarjeta(nodoEspera());

    expect(container.querySelector(".flow-node__blocks")).toBeNull();
    expect(container.querySelector(".wr-node")).not.toBeNull();
  });
});

describe("el ancho del nodo es el del sistema, no uno propio", () => {
  it("la herramienta NO declara ancho: lo fija `.flow-node` para las catorce", () => {
    // Tuvo un `:has(.wr-node) { width: 264px }` para que el nombre cupiera
    // entero en la cabecera, y al lado de Mensaje se veían dos nodos de tamaños
    // distintos. La retícula manda: el ancho es del cascarón y aquí no se toca.
    // Sin comentarios: estos hablan de `.flow-node__body` para explicar sobre
    // qué fondo se pinta el nodo, y una búsqueda en crudo los confundiría con
    // una regla.
    const hoja = readFileSync(
      "src/features/automations/builder/tools/wait-response/wait-response-editor.css",
      "utf8"
    ).replace(/\/\*[\s\S]*?\*\//g, "");

    // Ninguna regla de esta hoja puede fijar el ancho del nodo del lienzo.
    expect(hoja).not.toMatch(/\.flow-node[^{]*\{[^}]*width\s*:/);
    expect(hoja).not.toMatch(/:has\(\.wr-node\)/);
  });

  it("el ancho estándar sigue viviendo en una sola regla del lienzo", () => {
    // La fuente de verdad, para que este test falle si alguien la duplica.
    const lienzo = readFileSync(
      "src/features/automations/builder/components/canvas/flow-node.css",
      "utf8"
    );

    // Un solo `width` para `.flow-node`, y es el compartido por las catorce.
    const anchos = [...lienzo.matchAll(/^\.flow-node\s*\{[^}]*?width:\s*([^;]+);/gms)]
      .map(([, valor]) => valor.trim());

    expect(anchos).toEqual(["264px"]);
  });

  it("Mensaje y Esperar respuesta comparten ancho porque ninguno lo declara", () => {
    // La prueba de la consistencia: la única forma de que dos nodos midan lo
    // mismo sin coordinarse es que ninguno de los dos tenga ancho propio.
    const hojas = {
      "wait-response": "src/features/automations/builder/tools/wait-response/wait-response-editor.css",
      "message": "src/features/automations/builder/tools/message/message-editor.css"
    };

    for (const ruta of Object.values(hojas)) {
      const hoja = readFileSync(ruta, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(hoja).not.toMatch(/\.flow-node[^{]*\{[^}]*width\s*:/);
    }
  });
});

describe("el tamaño de los puntos de conexión es del sistema", () => {
  it("una sola regla global los fija, y no la declara ninguna herramienta", () => {
    const lienzo = readFileSync(
      "src/features/automations/builder/components/canvas/flow-node.css",
      "utf8"
    );

    // 12px para todos los handles del builder: entrada, salida única y las dos
    // salidas de Esperar respuesta.
    expect(lienzo).toMatch(
      /\.react-flow__handle\.flow-node__handle\s*\{[^}]*width:\s*12px;[^}]*height:\s*12px;/
    );

    // Y la herramienta no puede tener su propio tamaño: eso la sacaría de la
    // familia, que es el defecto que este ajuste corrige.
    const hoja = readFileSync(
      "src/features/automations/builder/tools/wait-response/wait-response-editor.css",
      "utf8"
    ).replace(/\/\*[\s\S]*?\*\//g, "");

    const reglas = [...hoja.matchAll(/\.wr-out__handle[^{]*\{([^}]*)\}/g)].map(([, c]) => c);
    for (const cuerpo of reglas) {
      expect(cuerpo).not.toMatch(/(^|;|\s)(width|height|background|border|border-radius)\s*:/);
    }
  });

  it("el color se entrega por las variables de React Flow, nunca por CSS directo", () => {
    // El mecanismo correcto: rellenar `--xy-handle-background-color` y
    // `--xy-handle-border-color`, que `.react-flow__handle` ya lee con
    // fallback a las suyas por defecto. Poner un `background:`/`border:`
    // literal aquí competiría con la propia especificidad de la librería en
    // vez de usar la puerta que deja abierta para esto.
    const lienzo = readFileSync(
      "src/features/automations/builder/components/canvas/flow-node.css",
      "utf8"
    ).replace(/\/\*[\s\S]*?\*\//g, "");

    const regla = lienzo.match(/\.react-flow__handle\.flow-node__handle\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(regla).toMatch(/--xy-handle-background-color:\s*var\(--handle-fill\)/);
    expect(regla).toMatch(/--xy-handle-border-color:\s*var\(--handle-border\)/);

    // Ninguna propiedad CSS literal de identidad: solo las custom properties de
    // arriba, el tamaño y el `z-index` de apilado.
    const sinVariables = regla.replace(/--xy-handle-[a-z-]+:\s*var\([^)]*\);?/g, "");
    expect(sinVariables).not.toMatch(/(^|;|\s)(background|border|border-radius|box-shadow)\s*:/);
  });

  it("--handle-fill y --handle-border son tokens de tema, no un valor de esta hoja", () => {
    // La fuente tiene que vivir en la paleta, no en el lienzo: es lo que
    // permite que dark y light declaren cada uno el suyo sin que este archivo
    // sepa en qué tema está.
    const lienzo = readFileSync(
      "src/features/automations/builder/components/canvas/flow-node.css",
      "utf8"
    );
    expect(lienzo).not.toMatch(/--handle-fill:\s*#/);
    expect(lienzo).not.toMatch(/--handle-border:\s*(#|rgba?\()/);

    for (const ruta of [
      "src/shared/styles/tokens/palette-dark.css",
      "src/shared/styles/tokens/palette-light.css"
    ]) {
      const paleta = readFileSync(ruta, "utf8");
      expect(paleta).toMatch(/--handle-fill:\s*#[0-9a-f]{3,6}/i);
      expect(paleta).toMatch(/--handle-border:\s*(#|rgba?\()/i);
    }
  });

  it("es plata neutra: ni el violeta del sistema, ni el dorado de una herramienta, ni el cyan que tuvo antes", () => {
    const dark = readFileSync("src/shared/styles/tokens/palette-dark.css", "utf8");
    const light = readFileSync("src/shared/styles/tokens/palette-light.css", "utf8");

    const relleno = (hoja: string) => hoja.match(/--handle-fill:\s*(#[0-9a-fA-F]{3,6})/)?.[1] ?? "";

    // LA IDENTIDAD SE PREGUNTA AL REGISTRO, no se copia aquí. Esta comprobación
    // ya se quedó desactualizada una vez: llevaba escrito a mano el ámbar
    // `#f59e0b` de cuando la herramienta era ámbar, así que seguía pasando
    // mientras afirmaba algo que había dejado de ser cierto. Leyendo el color
    // vigente de `definition.ts` —la única fuente— el test sigue a la
    // herramienta cuando la herramienta cambie de color.
    const doradoEspera = resolveTool("question").colors.header.toLowerCase();

    // Ni el primario de marca (violeta), ni el dorado de Esperar respuesta, ni
    // el cyan de la iteración anterior de este mismo token —los tres son
    // identidades que la plata tiene que dejar atrás, no solo evitar de
    // entrada—.
    expect(dark.match(/--primary:\s*(#[0-9a-fA-F]{3,6})/)?.[1]).not.toBe(relleno(dark));
    expect(light.match(/--primary:\s*(#[0-9a-fA-F]{3,6})/)?.[1]).not.toBe(relleno(light));
    expect(relleno(dark).toLowerCase()).not.toBe(doradoEspera);
    expect(relleno(light).toLowerCase()).not.toBe(doradoEspera);
    // El ámbar histórico se sigue vigilando, pero por lo que ES HOY y no por lo
    // que fue: el token `--amber` del tema claro y el trazo de una arista de
    // fallback. Que un punto de conexión no se confunda con ninguno de los dos
    // sigue siendo una garantía útil, aunque ya no sea el color de ninguna
    // herramienta.
    expect(relleno(dark).toLowerCase()).not.toBe("#f59e0b");
    expect(relleno(light).toLowerCase()).not.toBe("#f59e0b");
    expect(relleno(dark).toLowerCase()).not.toBe("#67e8f9");
    expect(relleno(light).toLowerCase()).not.toBe("#0891b2");

    // PLATA DE VERDAD: saturación baja —se lee neutro, metálico, no un color
    // vivo— pero no cero: `0` sería el «gris plano» que se pidió evitar
    // explícitamente. El rango 0-15% es el hueco real entre «tiene un matiz
    // frío perceptible» y «sigue siendo un color con nombre propio».
    function saturacion(hex: string): number {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      const l = (max + min) / 2;
      return delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    }

    for (const hex of [relleno(dark), relleno(light)]) {
      const s = saturacion(hex);
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThanOrEqual(0.15);
    }
  });

  it("dark y light se distinguen con contraste real contra SU propio lienzo", () => {
    // El pedido explícito: plata fría y luminosa en oscuro, acero medio en
    // claro. No es «uno siempre por encima de 0.5 de luminancia y el otro por
    // debajo» —esa regla de pulgar no describe un plateado medio de verdad
    // sobre un lienzo casi blanco—; lo que importa es el contraste real
    // contra el `--bg` de CADA tema, con la fórmula de contraste de WCAG.
    const dark = readFileSync("src/shared/styles/tokens/palette-dark.css", "utf8");
    const light = readFileSync("src/shared/styles/tokens/palette-light.css", "utf8");

    function hex(hoja: string, token: string): string {
      return hoja.match(new RegExp(`${token}:\\s*#([0-9a-fA-F]{6})`))?.[1] ?? "000000";
    }

    function luminanciaRelativa(hexSinAlmohadilla: string): number {
      const canal = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const r = canal(parseInt(hexSinAlmohadilla.slice(0, 2), 16));
      const g = canal(parseInt(hexSinAlmohadilla.slice(2, 4), 16));
      const b = canal(parseInt(hexSinAlmohadilla.slice(4, 6), 16));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function contraste(a: string, b: string): number {
      const [l1, l2] = [luminanciaRelativa(a), luminanciaRelativa(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    }

    // Umbral de WCAG para un componente de interfaz no textual (3:1), que es
    // justo la categoría a la que pertenece un punto de conexión.
    expect(contraste(hex(dark, "--handle-fill"), hex(dark, "--bg"))).toBeGreaterThanOrEqual(3);
    expect(contraste(hex(light, "--handle-fill"), hex(light, "--bg"))).toBeGreaterThanOrEqual(3);

    // Y no son el mismo valor: cada tema resuelve su propio contraste.
    expect(hex(dark, "--handle-fill")).not.toBe(hex(light, "--handle-fill"));
  });

  it("el aro sigue dando bisel: se distingue del relleno en los dos temas", () => {
    // «Definición y profundidad sin volverse pesado» es, en términos
    // medibles, que el aro y el relleno no sean el mismo tono: tiene que
    // haber un salto de contraste entre los dos para que se lea como un
    // borde y no como un círculo macizo de un solo color.
    const dark = readFileSync("src/shared/styles/tokens/palette-dark.css", "utf8");
    const light = readFileSync("src/shared/styles/tokens/palette-light.css", "utf8");

    function hex(hoja: string, token: string): string {
      return hoja.match(new RegExp(`${token}:\\s*#([0-9a-fA-F]{6})`))?.[1] ?? "000000";
    }

    function luminanciaRelativa(hexSinAlmohadilla: string): number {
      const canal = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const r = canal(parseInt(hexSinAlmohadilla.slice(0, 2), 16));
      const g = canal(parseInt(hexSinAlmohadilla.slice(2, 4), 16));
      const b = canal(parseInt(hexSinAlmohadilla.slice(4, 6), 16));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function contraste(a: string, b: string): number {
      const [l1, l2] = [luminanciaRelativa(a), luminanciaRelativa(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    }

    expect(contraste(hex(dark, "--handle-fill"), hex(dark, "--handle-border"))).toBeGreaterThan(1.5);
    expect(contraste(hex(light, "--handle-fill"), hex(light, "--handle-border"))).toBeGreaterThan(1.5);
  });

  it("los handles de un tool cualquiera y los de Esperar respuesta llevan la misma clase", () => {
    // La clase es la que recibe la regla global. Si una de las dos dejara de
    // llevarla, ese handle se quedaría a 6px y la familia se rompería.
    const espera = pintarNodo("question", {
      config: { waitIndefinitely: false, timeout: { amount: 30, unit: "minutes" } }
    });
    const otro = pintarNodo("tags", {});

    const deEspera = [...espera.querySelectorAll(".react-flow__handle")];
    const deOtro = [...otro.querySelectorAll(".react-flow__handle")];

    expect(deEspera.length).toBe(3); // entrada + dos salidas
    expect(deOtro.length).toBe(2); // entrada + salida única

    for (const handle of [...deEspera, ...deOtro]) {
      expect(handle.classList.contains("flow-node__handle")).toBe(true);
    }
  });
});

describe("las dos salidas propias tiñen su handle según lo que significan", () => {
  // «Respuesta» y «Tiempo agotado» dejan de ser dos plateados idénticos y pasan
  // a decir, con el color, qué representa cada uno: verde = el cliente
  // contestó, rojo = no lo hizo a tiempo. Es exclusivo de estas dos salidas —el
  // resto del Builder sigue plateado— y la selección es por la clase semántica
  // de la fila, nunca por posición ni por el texto del rótulo.

  function reglaDelHandle(hoja: string, selectorAncestro: string): string {
    const patron = new RegExp(
      `\\.wr-out--${selectorAncestro} \\.wr-out__handle\\.react-flow__handle\\s*\\{([^}]*)\\}`
    );
    return hoja.match(patron)?.[1] ?? "";
  }

  it("«Respuesta» usa --status-success", () => {
    const hoja = readFileSync(
      "src/features/automations/builder/tools/wait-response/wait-response-editor.css",
      "utf8"
    );

    expect(reglaDelHandle(hoja, "respuesta")).toMatch(
      /--xy-handle-background-color:\s*var\(--status-success\)/
    );
  });

  it("«Tiempo agotado» usa --status-danger", () => {
    const hoja = readFileSync(
      "src/features/automations/builder/tools/wait-response/wait-response-editor.css",
      "utf8"
    );

    expect(reglaDelHandle(hoja, "tiempo")).toMatch(
      /--xy-handle-background-color:\s*var\(--status-danger\)/
    );
  });

  it("no reescribe el borde: el bisel plateado del Builder se conserva en las dos", () => {
    const hoja = readFileSync(
      "src/features/automations/builder/tools/wait-response/wait-response-editor.css",
      "utf8"
    );

    for (const ancestro of ["respuesta", "tiempo"]) {
      expect(reglaDelHandle(hoja, ancestro)).not.toMatch(/--xy-handle-border-color/);
    }
  });

  it("--status-success y --status-danger existen como tokens de tema, no como hex de esta hoja", () => {
    // Reutiliza los mismos tokens que ya usa la tarjeta del Hub para
    // «conectado»/«desconectado»: ni se inventa un color nuevo ni se
    // hardcodea el hex dentro de la herramienta.
    const hoja = readFileSync(
      "src/features/automations/builder/tools/wait-response/wait-response-editor.css",
      "utf8"
    );
    expect(hoja).not.toMatch(/#22c55e|#ef4444/i);

    for (const ruta of [
      "src/shared/styles/tokens/palette-dark.css",
      "src/shared/styles/tokens/palette-light.css"
    ]) {
      const paleta = readFileSync(ruta, "utf8");
      expect(paleta).toMatch(/--status-success:\s*#[0-9a-f]{3,6}/i);
      expect(paleta).toMatch(/--status-danger:\s*#[0-9a-f]{3,6}/i);
    }
  });

  it("el handle de ENTRADA de Esperar respuesta no queda alcanzado por accidente", () => {
    // El selector exige la clase de la fila de salida como ancestro; la
    // entrada del nodo no vive dentro de ninguna `.wr-out--*` y por tanto no
    // puede heredar verde ni rojo.
    const container = pintarNodo("question", {
      config: { waitIndefinitely: false, timeout: { amount: 30, unit: "minutes" } }
    });

    const entrada = container.querySelector(".flow-node__handle--target");
    expect(entrada).not.toBeNull();
    expect(entrada?.closest(".wr-out--respuesta")).toBeNull();
    expect(entrada?.closest(".wr-out--tiempo")).toBeNull();
  });

  it("el resto del Builder —incluida la regla global— sigue plateado, sin verde ni rojo", () => {
    // La fuente global de identidad de handle sigue siendo únicamente
    // `--handle-fill`/`--handle-border`: el verde/rojo no se ha filtrado ahí.
    const lienzo = readFileSync(
      "src/features/automations/builder/components/canvas/flow-node.css",
      "utf8"
    );
    const reglaGlobal = lienzo.match(
      /\.react-flow__handle\.flow-node__handle\s*\{([^}]*)\}/
    )?.[1] ?? "";

    expect(reglaGlobal).toMatch(/--xy-handle-background-color:\s*var\(--handle-fill\)/);
    expect(reglaGlobal).not.toMatch(/--status-success|--status-danger/);

    // Y ninguna otra herramienta declara nada parecido. Recorre TODA
    // `tools/`, subcarpetas incluidas —Mensaje guarda las suyas en
    // `styles/`—, para no depender de una lista de nombres que alguien tenga
    // que recordar mantener al día.
    function hojasCssBajo(carpeta: string): string[] {
      const encontradas: string[] = [];
      for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
        const ruta = `${carpeta}/${entrada.name}`;
        if (entrada.isDirectory()) encontradas.push(...hojasCssBajo(ruta));
        else if (entrada.name.endsWith(".css")) encontradas.push(ruta);
      }
      return encontradas;
    }

    const todasLasHojas = hojasCssBajo("src/features/automations/builder/tools");
    const deOtrasHerramientas = todasLasHojas.filter((ruta) => !ruta.includes("/wait-response/"));

    expect(deOtrasHerramientas.length).toBeGreaterThan(0);
    for (const ruta of deOtrasHerramientas) {
      expect(readFileSync(ruta, "utf8")).not.toMatch(/--status-success|--status-danger/);
    }
  });
});

describe("ningún handle se recorta: la causa real era `.flow-node { overflow: hidden }`", () => {
  // Un `Handle` se centra en el borde del nodo por diseño de React Flow —mitad
  // dentro, mitad fuera—, y un antepasado con `overflow: hidden` recorta esa
  // mitad exterior sin que ningún `z-index` pueda evitarlo: el z-index resuelve
  // QUIÉN PINTA ENCIMA, no QUÉ SE RECORTA. Son dos causas distintas y las dos
  // tenían que corregirse para que el punto se vea completo.

  it("`.flow-node` y `.flow-node--entry` ya no recortan lo que se asoma al borde", () => {
    const lienzo = readFileSync(
      "src/features/automations/builder/components/canvas/flow-node.css",
      "utf8"
    ).replace(/\/\*[\s\S]*?\*\//g, "");

    const bloque = (selector: string) => {
      const inicio = lienzo.indexOf(selector);
      return lienzo.slice(inicio, lienzo.indexOf("}", inicio));
    };

    expect(bloque(".flow-node {")).not.toMatch(/overflow\s*:/);
    expect(bloque(".flow-node--entry {")).not.toMatch(/overflow\s*:/);
  });

  it("la cabecera y el cuerpo redondean sus propias esquinas, con el mismo radio del nodo", () => {
    // Compensación del punto anterior: sin el recorte del padre, cada
    // superficie tiene que resolver sus propias esquinas para que el nodo siga
    // viéndose redondeado exactamente igual que antes.
    const lienzo = readFileSync(
      "src/features/automations/builder/components/canvas/flow-node.css",
      "utf8"
    ).replace(/\/\*[\s\S]*?\*\//g, "");

    const radioNodo = lienzo.match(/\.flow-node\s*\{[^}]*border-radius:\s*(\d+px)/)?.[1];
    expect(radioNodo).toBeTruthy();

    const header = lienzo.slice(
      lienzo.indexOf(".flow-node__header {"),
      lienzo.indexOf("}", lienzo.indexOf(".flow-node__header {"))
    );
    const body = lienzo.slice(
      lienzo.indexOf(".flow-node__body {"),
      lienzo.indexOf("}", lienzo.indexOf(".flow-node__body {"))
    );

    expect(header).toContain(`border-top-left-radius: ${radioNodo}`);
    expect(header).toContain(`border-top-right-radius: ${radioNodo}`);
    expect(body).toContain(`border-bottom-left-radius: ${radioNodo}`);
    expect(body).toContain(`border-bottom-right-radius: ${radioNodo}`);
  });

  it("el punto está en un plano por encima de las superficies del nodo", () => {
    // La otra mitad del arreglo: sin recorte, el handle es libre de mostrarse
    // completo, pero seguía pudiendo quedar TAPADO por la cabecera/cuerpo según
    // el orden de pintado. `z-index` es lo que lo resuelve.
    const lienzo = readFileSync(
      "src/features/automations/builder/components/canvas/flow-node.css",
      "utf8"
    ).replace(/\/\*[\s\S]*?\*\//g, "");

    const regla = lienzo.match(/\.react-flow__handle\.flow-node__handle\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(regla).toMatch(/z-index:\s*1/);
  });
});

describe("la hoja de la herramienta no acumula tokens muertos", () => {
  it("cada token --wr-* declarado se usa al menos una vez", () => {
    // `--wr-amber-deep` estaba declarado y no lo usaba nadie, con un comentario
    // que además afirmaba un uso inexistente. Lo que se fija no es su ausencia
    // —eso sería pinchar un color— sino la regla: un token que se declara se
    // usa, o no se declara.
    const hoja = readFileSync(
      "src/features/automations/builder/tools/wait-response/wait-response-editor.css",
      "utf8"
    );

    const declarados = [...hoja.matchAll(/^\s*(--wr-[a-z-]+):/gm)].map(([, nombre]) => nombre);
    expect(declarados.length).toBeGreaterThan(0);

    const muertos = declarados.filter((token) => !hoja.includes(`var(${token})`));
    expect(muertos).toEqual([]);
  });
});

describe("independencia entre herramientas", () => {
  it("Esperar respuesta no monta ninguna pieza de Mensaje", () => {
    const { container } = render(<MarcoGobernado inicial={nodoEspera()} />);

    for (const clase of ["message-editor", "message-builder", "message-item", "send-once"]) {
      expect(container.querySelector(`.${clase}`)).toBeNull();
    }
  });

  it("Mensaje sigue teniendo su editor y su cuerpo propios", () => {
    // No regresión: tocar el registro de una herramienta no puede alterar el de
    // otra. Las dos declaran editor y cuerpo, y son componentes DISTINTOS.
    const espera = resolveToolUi("question");
    const mensaje = resolveToolUi("message");

    expect(mensaje.Editor).toBeDefined();
    expect(mensaje.CompactBody).toBeDefined();
    expect(espera.Editor).toBeDefined();
    expect(espera.CompactBody).toBeDefined();
    expect(espera.Editor).not.toBe(mensaje.Editor);
    expect(espera.CompactBody).not.toBe(mensaje.CompactBody);
  });

  it("su icono NO es el de Mensaje: en la paleta hay que poder distinguirlas", () => {
    // Llevaba el mismo contorno de bocadillo que `MessageIcon`, carácter por
    // carácter, y solo cambiaba lo de dentro: a 18px eran la misma cosa justo
    // donde el usuario elige entre las dos. Ahora es un reloj de arena.
    const { Icon: IconoEspera } = resolveToolUi("question");
    const { Icon: IconoMensaje } = resolveToolUi("message");

    const espera = render(<IconoEspera />).container.innerHTML;
    const mensaje = render(<IconoMensaje />).container.innerHTML;

    expect(espera).not.toBe(mensaje);
    // Y tampoco el círculo con agujas de Intervalo, que ya ocupa esa silueta.
    expect(render(<IconoEspera />).container.querySelector("circle")).toBeNull();
  });

  it("Mensaje conserva sus ganchos y Esperar respuesta declara solo los suyos", () => {
    const mensaje = resolveTool("message");
    const espera = resolveTool("question");

    // Mensaje necesita los cuatro: su config lleva identidades y archivos.
    expect(mensaje.duplicateConfig).toBeDefined();
    expect(mensaje.releaseResources).toBeDefined();

    // Esperar respuesta no reserva nada fuera de su config ni tiene identidades
    // internas: declarar esos ganchos habría sido ceremonia vacía.
    expect(espera.duplicateConfig).toBeUndefined();
    expect(espera.releaseResources).toBeUndefined();
    expect(espera.summarize).toBeDefined();
    expect(espera.validateContent).toBeDefined();
  });
});
