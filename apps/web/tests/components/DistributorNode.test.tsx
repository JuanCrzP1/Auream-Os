import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider, type NodeProps } from "@xyflow/react";
import { NodeExpandedFrame } from "@features/automations/builder/components/canvas/NodeExpandedFrame";
import { FlowNodeCard } from "@features/automations/builder/components/canvas/FlowNodeCard";
import { BuilderEditingProvider } from "@features/automations/builder/context/BuilderEditingContext";
import { applyNodePatch } from "@features/automations/builder/services/applyNodePatch";
import { createNodeDraft } from "@features/automations/builder/services/createNodeDraft";
import { resolveTool } from "@features/automations/builder/tools/registry";
import { resolveToolUi } from "@features/automations/builder/tools/ui-registry";
import { readDistributorOutputs } from "@features/automations/builder/tools/distributor/readDistributorConfig";
import type { CanvasNode } from "@features/automations/builder/types/canvas";

// ---------------------------------------------------------------------------
// El «Distribuidor» dentro del Builder, por el camino real.
//
// No se monta el editor suelto: se monta el MARCO GENÉRICO que lo contiene
// —`NodeExpandedFrame`, el mismo que usan Mensaje y Esperar respuesta— y la
// TARJETA REAL del lienzo —`FlowNodeCard`—. Lo que se prueba es la costura: que
// añadir una salida cambie la configuración, que Guardar la conserve, que
// Cancelar la descarte y que los puntos de conexión del nodo salgan de esa
// misma configuración y de ningún sitio más.
//
// Si alguien construyera un modal propio para esta herramienta o una lista de
// handles escrita a mano, este archivo dejaría de pasar: está escrito contra la
// infraestructura compartida a propósito.
// ---------------------------------------------------------------------------

function nodoDistribuidor(): CanvasNode {
  return createNodeDraft("distributor", 0);
}

/**
 * Marco real gobernando un nodo real: `onCommit` aplica el parche con
 * `applyNodePatch` y el nodo resultante vuelve a entrar al marco, igual que
 * hace el lienzo.
 */
function MarcoGobernado({ inicial }: { readonly inicial: CanvasNode }) {
  const [nodo, setNodo] = useState(inicial);
  // Cerrar DESMONTA el editor, igual que en el lienzo: es lo que hace que el
  // borrador no confirmado desaparezca de verdad. Sin esto, «Cancelar» dejaría
  // el marco montado con lo escrito dentro y la prueba estaría midiendo el
  // arnés en vez del comportamiento.
  const [abierto, setAbierto] = useState(true);

  return (
    <>
      {abierto ? (
        <NodeExpandedFrame
          data={nodo.data}
          tool={resolveTool(nodo.data.nodeType)}
          ui={resolveToolUi(nodo.data.nodeType)}
          onCommit={(patch) => setNodo((previo) => applyNodePatch(previo, patch))}
          onClose={() => setAbierto(false)}
        />
      ) : (
        <button type="button" onClick={() => setAbierto(true)}>
          reabrir
        </button>
      )}
      {/* Espejo de lo que está GUARDADO en el nodo, no de lo que hay escrito en
          el editor. Es lo que permite distinguir editar de guardar sin
          inspeccionar el estado interno del marco. */}
      <output data-testid="guardado">
        {readDistributorOutputs(nodo.data.config).map((salida) => salida.label).join(", ")}
      </output>
    </>
  );
}

/** Pinta la tarjeta cerrada de un nodo dentro del lienzo. Devuelve el contenedor. */
function pintarTarjeta(nodo: CanvasNode): HTMLElement {
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

/** Un nodo con `n` salidas ya guardadas, creadas por el camino del editor. */
function conSalidas(n: number): CanvasNode {
  let nodo = nodoDistribuidor();

  for (let i = 0; i < n; i += 1) {
    const salidas = readDistributorOutputs(nodo.data.config);
    nodo = applyNodePatch(nodo, {
      config: {
        ...nodo.data.config,
        outputs: [...salidas, { id: `ds-test-${i + 1}`, label: `Salida ${i + 1}` }]
      }
    });
  }

  return nodo;
}

const anadir = () => fireEvent.click(screen.getByRole("button", { name: "Añadir salida" }));
const guardar = () => fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
const salidasEnElEditor = () =>
  screen.queryAllByRole("listitem").map((fila) => fila.textContent?.trim() ?? "");

describe("estado inicial", () => {
  it("un Distribuidor nuevo llega al editor sin ninguna salida", () => {
    const nodo = nodoDistribuidor();

    expect(readDistributorOutputs(nodo.data.config)).toEqual([]);
  });

  it("el editor enseña el estado vacío, no una «Salida 1» de cortesía", () => {
    render(<MarcoGobernado inicial={nodoDistribuidor()} />);

    expect(screen.getByText("No hay salidas configuradas todavía.")).toBeInTheDocument();
    expect(salidasEnElEditor()).toEqual([]);
    expect(screen.queryByText(/Salida 1/)).toBeNull();
  });

  it("ofrece crear la primera salida", () => {
    render(<MarcoGobernado inicial={nodoDistribuidor()} />);

    expect(screen.getByRole("button", { name: "Añadir salida" })).toBeEnabled();
  });
});

describe("añadir salidas", () => {
  it("la primera salida aparece en el editor y el estado vacío desaparece", () => {
    render(<MarcoGobernado inicial={nodoDistribuidor()} />);

    anadir();

    expect(salidasEnElEditor()).toEqual(["Salida 1"]);
    expect(screen.queryByText("No hay salidas configuradas todavía.")).toBeNull();
  });

  it("admite varias, y cada una se añade a las anteriores", () => {
    render(<MarcoGobernado inicial={nodoDistribuidor()} />);

    anadir();
    expect(salidasEnElEditor()).toEqual(["Salida 1"]);

    anadir();
    expect(salidasEnElEditor()).toEqual(["Salida 1", "Salida 2"]);

    anadir();
    expect(salidasEnElEditor()).toEqual(["Salida 1", "Salida 2", "Salida 3"]);
  });

  it("añadir NO guarda todavía: eso es del botón Guardar", () => {
    render(<MarcoGobernado inicial={nodoDistribuidor()} />);

    anadir();

    expect(salidasEnElEditor()).toEqual(["Salida 1"]);
    expect(screen.getByTestId("guardado").textContent).toBe("");
  });
});

describe("eliminar salidas", () => {
  it("elimina la señalada y deja las demás", () => {
    render(<MarcoGobernado inicial={nodoDistribuidor()} />);
    anadir();
    anadir();
    anadir();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Salida 2" }));

    expect(salidasEnElEditor()).toEqual(["Salida 1", "Salida 3"]);
  });

  it("vaciar la lista devuelve el estado vacío, no un nodo roto", () => {
    render(<MarcoGobernado inicial={nodoDistribuidor()} />);
    anadir();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Salida 1" }));

    expect(salidasEnElEditor()).toEqual([]);
    expect(screen.getByText("No hay salidas configuradas todavía.")).toBeInTheDocument();
  });

  it("cada botón de eliminar dice a qué salida pertenece", () => {
    // Con cuatro botones idénticos, un «Eliminar» a secas no identifica ninguno
    // para quien navega con lector de pantalla.
    render(<MarcoGobernado inicial={nodoDistribuidor()} />);
    anadir();
    anadir();

    expect(screen.getByRole("button", { name: "Eliminar Salida 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar Salida 2" })).toBeInTheDocument();
  });
});

describe("guardar y descartar, por el camino del marco compartido", () => {
  it("Guardar conserva las salidas en el nodo", () => {
    render(<MarcoGobernado inicial={nodoDistribuidor()} />);
    anadir();
    anadir();

    guardar();

    expect(screen.getByTestId("guardado").textContent).toBe("Salida 1, Salida 2");
  });

  it("Cancelar descarta lo añadido: el nodo no cambia y al reabrir no queda rastro", () => {
    render(<MarcoGobernado inicial={nodoDistribuidor()} />);
    anadir();
    anadir();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    // Ni se confirmó nada…
    expect(screen.getByTestId("guardado").textContent).toBe("");

    // …ni sobrevive al volver a entrar: el borrador no confirmado muere con el
    // marco, que es de quien es.
    fireEvent.click(screen.getByRole("button", { name: "reabrir" }));

    expect(salidasEnElEditor()).toEqual([]);
    expect(screen.getByText("No hay salidas configuradas todavía.")).toBeInTheDocument();
  });

  it("Guardar nace deshabilitado: sin cambios no hay nada que confirmar", () => {
    render(<MarcoGobernado inicial={nodoDistribuidor()} />);

    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("una eliminación también se confirma con Guardar", () => {
    render(<MarcoGobernado inicial={conSalidas(2)} />);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Salida 1" }));
    guardar();

    expect(screen.getByTestId("guardado").textContent).toBe("Salida 2");
  });

  it("la configuración guardada conserva lo que esta versión no conoce", () => {
    // `applyNodePatch` reemplaza el objeto entero: si el editor no conservara el
    // resto, guardar una salida borraría campos escritos por otra versión.
    const nodo = applyNodePatch(nodoDistribuidor(), { config: { deOtraVersion: 7 } });
    render(<MarcoGobernado inicial={nodo} />);

    anadir();
    guardar();

    expect(screen.getByTestId("guardado").textContent).toBe("Salida 1");
  });
});

describe("los puntos de conexión salen de la configuración", () => {
  const salidasDelNodo = (contenedor: HTMLElement) =>
    contenedor.querySelectorAll(".react-flow__handle-right");

  it("sin salidas no hay ningún punto de origen, pero sí el de entrada", () => {
    // Ni siquiera el genérico del cascarón: `ownsOutputs` lo aparta. Ofrecer un
    // punto sin salida configurada invitaría a conectar algo que la
    // configuración no reconoce.
    //
    // La entrada se comprueba en la misma prueba a propósito: sin ella, «cero
    // puntos de salida» también se cumpliría si el nodo no hubiera pintado
    // nada, y esto no distinguiría un nodo correcto de uno roto.
    const contenedor = pintarTarjeta(nodoDistribuidor());

    expect(salidasDelNodo(contenedor)).toHaveLength(0);
    expect(contenedor.querySelectorAll(".flow-node__handle--target")).toHaveLength(1);
  });

  it("una salida, un punto", () => {
    expect(salidasDelNodo(pintarTarjeta(conSalidas(1)))).toHaveLength(1);
  });

  it("dos salidas, dos puntos", () => {
    expect(salidasDelNodo(pintarTarjeta(conSalidas(2)))).toHaveLength(2);
  });

  it("tres salidas, tres puntos", () => {
    expect(salidasDelNodo(pintarTarjeta(conSalidas(3)))).toHaveLength(3);
  });

  it("seis salidas, seis puntos: no hay tope escrito a mano", () => {
    expect(salidasDelNodo(pintarTarjeta(conSalidas(6)))).toHaveLength(6);
  });

  it("cada punto lleva la identidad de SU salida", () => {
    // Es lo que la arista guarda como `fromOutput` y lo que la devuelve a su
    // punto exacto al recargar el flujo. Si los ids no fueran los de las
    // salidas, una conexión guardada volvería al sitio equivocado.
    const nodo = conSalidas(3);
    const contenedor = pintarTarjeta(nodo);

    const enElNodo = [...contenedor.querySelectorAll(".ds-out__handle")].map((punto) =>
      punto.getAttribute("data-handleid")
    );

    expect(enElNodo).toEqual(readDistributorOutputs(nodo.data.config).map((s) => s.id));
  });

  it("borrar una salida retira SU punto y deja los otros", () => {
    const tres = conSalidas(3);
    const salidas = readDistributorOutputs(tres.data.config);
    const dos = applyNodePatch(tres, {
      config: { ...tres.data.config, outputs: salidas.filter((s) => s.id !== salidas[1].id) }
    });

    const contenedor = pintarTarjeta(dos);

    expect(salidasDelNodo(contenedor)).toHaveLength(2);
    expect(
      [...contenedor.querySelectorAll(".ds-out__handle")].map((p) => p.getAttribute("data-handleid"))
    ).toEqual([salidas[0].id, salidas[2].id]);
  });

  it("los puntos llevan las clases del Builder, no unas propias", () => {
    // La identidad de un handle —tamaño y color— la fija `flow-node.css` una
    // sola vez para las catorce herramientas. Esta se engancha ahí en vez de
    // repintarse por su cuenta.
    const contenedor = pintarTarjeta(conSalidas(1));
    const punto = contenedor.querySelector(".ds-out__handle");

    expect(punto).toHaveClass("flow-node__handle");
    expect(punto).toHaveClass("flow-node__handle--source");
  });
});

describe("el nodo cerrado en el lienzo", () => {
  it("sin salidas dice que no hay ninguna", () => {
    const contenedor = pintarTarjeta(nodoDistribuidor());

    expect(contenedor.querySelector(".ds-node__empty")?.textContent).toBe(
      "Sin salidas configuradas"
    );
  });

  it("con salidas enseña el recuento y los rótulos", () => {
    const contenedor = pintarTarjeta(conSalidas(3));

    expect(contenedor.querySelector(".ds-node__count")?.textContent).toBe("3 salidas");
    expect([...contenedor.querySelectorAll(".ds-out__label")].map((s) => s.textContent)).toEqual([
      "Salida 1",
      "Salida 2",
      "Salida 3"
    ]);
  });

  it("es un RESUMEN: no monta el editor ni sus acciones", () => {
    const contenedor = pintarTarjeta(conSalidas(2));

    expect(contenedor.querySelector(".distributor")).toBeNull();
    expect(contenedor.querySelector(".distributor__add")).toBeNull();
    expect(contenedor.querySelector(".ds-row__remove")).toBeNull();
  });

  it("no añade botones propios a la cabecera del nodo", () => {
    // Editar, duplicar y eliminar son del cascarón y son los mismos para las
    // catorce herramientas.
    const contenedor = pintarTarjeta(conSalidas(2));

    expect(contenedor.querySelectorAll(".flow-node__action-btn")).toHaveLength(3);
  });

  it("publica el plateado de la herramienta al lienzo", () => {
    const contenedor = pintarTarjeta(nodoDistribuidor());
    const tarjeta = contenedor.querySelector<HTMLElement>(".flow-node");

    const tool = resolveTool("distributor");
    expect(tarjeta?.style.getPropertyValue("--flow-node-accent")).toBe(tool.colors.header);
    expect(tarjeta?.style.getPropertyValue("--flow-node-surface")).toBe(tool.colors.body);
  });
});

describe("la identidad de la herramienta llega al lienzo", () => {
  it("el icono es un SVG del sistema, no un emoji", () => {
    const contenedor = pintarTarjeta(nodoDistribuidor());
    const icono = contenedor.querySelector(".flow-node__type-icon");

    expect(icono?.querySelector("svg")).not.toBeNull();
    expect(icono?.textContent).toBe("");
  });
});

describe("independencia entre herramientas", () => {
  it("el Distribuidor no monta ninguna pieza de Mensaje ni de Esperar respuesta", () => {
    const { container } = render(<MarcoGobernado inicial={conSalidas(2)} />);

    // El editor del Distribuidor SÍ está montado: sin esto, «no hay clases de
    // las otras» también se cumpliría con la pantalla vacía.
    expect(container.querySelector(".distributor")).not.toBeNull();

    for (const clase of [
      "message-editor",
      "message-item",
      "send-once",
      "wait-response",
      "wr-switch",
      "wr-node",
      "wr-out"
    ]) {
      expect(container.querySelector(`.${clase}`), `montó .${clase}`).toBeNull();
    }
  });
});
