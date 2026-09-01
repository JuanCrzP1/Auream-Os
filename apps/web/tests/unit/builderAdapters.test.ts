import { describe, it, expect } from "vitest";
import { mapSnapshotToCanvas } from "../../src/features/automations/builder/adapters/mapSnapshotToCanvas";
import { mapCanvasToSnapshot } from "../../src/features/automations/builder/adapters/mapCanvasToSnapshot";
import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";
import type { CanvasEdge, CanvasNode } from "../../src/features/automations/builder/types/canvas";

// ---------------------------------------------------------------------------
// Frontera de serialización del builder.
//
// Estos dos adaptadores son el punto por donde puede perderse trabajo del
// usuario: todo lo que se construye en el lienzo pasa por aquí antes de
// guardarse, y todo lo guardado pasa por aquí antes de volver a dibujarse.
//
// Se prueba la ida y vuelta completa, no cada función por separado: lo que hay
// que garantizar es que la composición conserve la información, que es
// exactamente lo que un test por función no vería.
// ---------------------------------------------------------------------------

function makeSnapshot(): BuilderFlowSnapshot {
  return {
    flow: {
      id: "flow-1",
      tenantId: "tenant-a",
      key: "bienvenida",
      name: "Bienvenida",
      currentPublishedVersionId: null
    },
    version: {
      id: "v1",
      tenantId: "tenant-a",
      flowId: "flow-1",
      versionNumber: 3,
      status: "draft",
      entryNodeId: "n-inicio"
    },
    nodes: {
      "n-inicio": {
        id: "n-inicio",
        tenantId: "tenant-a",
        flowVersionId: "v1",
        type: "message",
        name: "Inicio",
        content: { text: "Hola" },
        config: { canal: "whatsapp" },
        metadata: { ui: { x: 120, y: 240 }, creadoPor: "test" }
      },
      "n-pregunta": {
        id: "n-pregunta",
        tenantId: "tenant-a",
        flowVersionId: "v1",
        type: "question",
        name: "Esperar respuesta",
        content: { text: "¿Cómo te llamas?" },
        config: { targetKey: "context.nombre" },
        metadata: { ui: { x: 480, y: 240 } }
      },
      "n-fin": {
        id: "n-fin",
        tenantId: "tenant-a",
        flowVersionId: "v1",
        type: "end",
        name: "Fin",
        content: {},
        config: {},
        metadata: { ui: { x: 840, y: 240 } }
      }
    },
    edgesBySource: {
      "n-inicio": [
        {
          id: "e-1",
          fromNodeId: "n-inicio",
          toNodeId: "n-pregunta",
          priority: 10,
          isFallback: false,
          condition: { operator: "always" }
        }
      ],
      "n-pregunta": [
        {
          id: "e-2",
          fromNodeId: "n-pregunta",
          toNodeId: "n-fin",
          priority: 20,
          isFallback: false,
          condition: { operator: "equals", fact: "context.nombre", value: "Ana" }
        },
        {
          id: "e-3",
          fromNodeId: "n-pregunta",
          toNodeId: "n-fin",
          priority: 99,
          isFallback: true,
          condition: { operator: "always" }
        }
      ]
    }
  } as unknown as BuilderFlowSnapshot;
}

describe("adapters — ida y vuelta snapshot → canvas → snapshot", () => {
  it("conserva los nodos con su tipo, nombre, contenido y configuración", () => {
    const original = makeSnapshot();
    const canvas = mapSnapshotToCanvas(original);
    const result = mapCanvasToSnapshot(original, canvas.nodes, canvas.edges);

    expect(Object.keys(result.nodes).sort()).toEqual(["n-fin", "n-inicio", "n-pregunta"]);
    expect(result.nodes["n-inicio"].type).toBe("message");
    expect(result.nodes["n-inicio"].name).toBe("Inicio");
    expect(result.nodes["n-inicio"].content.text).toBe("Hola");
    expect(result.nodes["n-inicio"].config).toEqual({ canal: "whatsapp" });
    expect(result.nodes["n-pregunta"].config).toEqual({ targetKey: "context.nombre" });
  });

  it("conserva las posiciones del lienzo", () => {
    const original = makeSnapshot();
    const canvas = mapSnapshotToCanvas(original);
    const result = mapCanvasToSnapshot(original, canvas.nodes, canvas.edges);

    expect(result.nodes["n-inicio"].metadata.ui).toEqual({ x: 120, y: 240 });
    expect(result.nodes["n-pregunta"].metadata.ui).toEqual({ x: 480, y: 240 });
    expect(result.nodes["n-fin"].metadata.ui).toEqual({ x: 840, y: 240 });
  });

  it("no pierde metadatos ajenos a la interfaz", () => {
    const original = makeSnapshot();
    const canvas = mapSnapshotToCanvas(original);
    const result = mapCanvasToSnapshot(original, canvas.nodes, canvas.edges);

    expect(result.nodes["n-inicio"].metadata.creadoPor).toBe("test");
  });

  it("conserva prioridad, condición y fallback de cada conexión", () => {
    const original = makeSnapshot();
    const canvas = mapSnapshotToCanvas(original);
    const result = mapCanvasToSnapshot(original, canvas.nodes, canvas.edges);

    expect(result.edgesBySource).toEqual(original.edgesBySource);
  });

  it("la prioridad sobrevive aunque ya no se dibuje en el lienzo", () => {
    // Retirar la etiqueta «Priority XX» fue un cambio de presentación. Este
    // test es el que impide que se convierta en una pérdida de modelo.
    const original = makeSnapshot();
    const canvas = mapSnapshotToCanvas(original);

    const pintadas = canvas.edges.map((edge) => edge.label);
    expect(pintadas).not.toContain("Priority 10");
    expect(pintadas).not.toContain("Priority 20");

    const result = mapCanvasToSnapshot(original, canvas.nodes, canvas.edges);
    expect(result.edgesBySource["n-pregunta"].map((edge) => edge.priority)).toEqual([20, 99]);
  });

  it("agrupa las conexiones por origen y las ordena por prioridad", () => {
    const original = makeSnapshot();
    const canvas = mapSnapshotToCanvas(original);

    // Se invierte el orden en el lienzo: el orden de ejecución no puede
    // depender de en qué orden estén los edges en memoria.
    const invertidas = [...canvas.edges].reverse();
    const result = mapCanvasToSnapshot(original, canvas.nodes, invertidas);

    expect(result.edgesBySource["n-pregunta"].map((edge) => edge.priority)).toEqual([20, 99]);
  });

  it("conserva flow y version sin tocarlos", () => {
    const original = makeSnapshot();
    const canvas = mapSnapshotToCanvas(original);
    const result = mapCanvasToSnapshot(original, canvas.nodes, canvas.edges);

    expect(result.flow).toEqual(original.flow);
    expect(result.version).toEqual(original.version);
  });
});

describe("adapters — canvas → snapshot → canvas", () => {
  it("devuelve los mismos nodos y conexiones tras el viaje de vuelta", () => {
    const original = makeSnapshot();
    const primero = mapSnapshotToCanvas(original);
    const snapshot = mapCanvasToSnapshot(original, primero.nodes, primero.edges);
    const segundo = mapSnapshotToCanvas(snapshot);

    expect(segundo.nodes.map((node) => node.id).sort()).toEqual(
      primero.nodes.map((node) => node.id).sort()
    );
    expect(segundo.edges.map((edge) => edge.id).sort()).toEqual(
      primero.edges.map((edge) => edge.id).sort()
    );
  });

  it("es estable: una segunda vuelta no cambia nada más", () => {
    const original = makeSnapshot();
    const canvas = mapSnapshotToCanvas(original);
    const unaVuelta = mapCanvasToSnapshot(original, canvas.nodes, canvas.edges);
    const dosVueltas = mapCanvasToSnapshot(
      original,
      mapSnapshotToCanvas(unaVuelta).nodes,
      mapSnapshotToCanvas(unaVuelta).edges
    );

    expect(dosVueltas).toEqual(unaVuelta);
  });

  it("marca como entrada solo al nodo que declara la versión", () => {
    const canvas = mapSnapshotToCanvas(makeSnapshot());

    expect(canvas.nodes.filter((node) => node.data.isEntry).map((node) => node.id)).toEqual([
      "n-inicio"
    ]);
  });

  it("marca como terminal el nodo de cierre y solo ese", () => {
    const canvas = mapSnapshotToCanvas(makeSnapshot());

    expect(canvas.nodes.filter((node) => node.data.isTerminal).map((node) => node.id)).toEqual([
      "n-fin"
    ]);
  });
});

describe("adapters — reglas de defensa", () => {
  it("descarta las conexiones cuyo origen o destino ya no existe", () => {
    const original = makeSnapshot();
    const canvas = mapSnapshotToCanvas(original);

    // Se elimina el nodo intermedio dejando sus conexiones colgando, que es lo
    // que ocurriría si algo borrase un nodo sin limpiar sus aristas.
    const nodosSinPregunta = canvas.nodes.filter((node) => node.id !== "n-pregunta");
    const result = mapCanvasToSnapshot(original, nodosSinPregunta, canvas.edges);

    const serializadas = Object.values(result.edgesBySource).flat();
    expect(serializadas).toHaveLength(0);
    expect(result.nodes["n-pregunta"]).toBeUndefined();
  });

  it("dibuja un tipo de herramienta retirado en lugar de romper el lienzo", () => {
    const original = makeSnapshot();
    const conTipoRetirado = {
      ...original,
      nodes: {
        ...original.nodes,
        "n-viejo": {
          id: "n-viejo",
          tenantId: "tenant-a",
          flowVersionId: "v1",
          type: "capture",
          name: "Captura antigua",
          content: {},
          config: {},
          metadata: { ui: { x: 10, y: 10 } }
        }
      }
    } as unknown as BuilderFlowSnapshot;

    const canvas = mapSnapshotToCanvas(conTipoRetirado);
    const viejo = canvas.nodes.find((node) => node.id === "n-viejo");

    expect(viejo).toBeDefined();
    expect(viejo?.data.nodeType).toBe("capture");
    // No es terminal ni entrada: cae en la presentación neutra del registry.
    expect(viejo?.data.isTerminal).toBe(false);
  });

  it("coloca en una posición por defecto un nodo sin coordenadas guardadas", () => {
    const original = makeSnapshot();
    const sinUi = {
      ...original,
      nodes: {
        "n-inicio": { ...original.nodes["n-inicio"], metadata: {} }
      },
      edgesBySource: {}
    } as unknown as BuilderFlowSnapshot;

    const canvas = mapSnapshotToCanvas(sinUi);

    expect(canvas.nodes[0].position).toEqual({ x: 120, y: 120 });
  });
});

describe("adapters — edición en el lienzo", () => {
  it("serializa el texto editado como contenido del nodo", () => {
    const original = makeSnapshot();
    const canvas = mapSnapshotToCanvas(original);

    const editados: CanvasNode[] = canvas.nodes.map((node) =>
      node.id === "n-inicio"
        ? { ...node, data: { ...node.data, preview: "Hola de nuevo", title: "Saludo" } }
        : node
    );

    const result = mapCanvasToSnapshot(original, editados, canvas.edges);

    expect(result.nodes["n-inicio"].content.text).toBe("Hola de nuevo");
    expect(result.nodes["n-inicio"].name).toBe("Saludo");
  });

  it("serializa un nodo movido con su nueva posición", () => {
    const original = makeSnapshot();
    const canvas = mapSnapshotToCanvas(original);

    const movidos: CanvasNode[] = canvas.nodes.map((node) =>
      node.id === "n-fin" ? { ...node, position: { x: 1000, y: 50 } } : node
    );

    const result = mapCanvasToSnapshot(original, movidos, canvas.edges);

    expect(result.nodes["n-fin"].metadata.ui).toEqual({ x: 1000, y: 50 });
  });

  it("completa los datos de una conexión creada sin ellos", () => {
    const original = makeSnapshot();
    const canvas = mapSnapshotToCanvas(original);

    const nueva = { id: "e-nueva", source: "n-inicio", target: "n-fin" } as CanvasEdge;
    const result = mapCanvasToSnapshot(original, canvas.nodes, [...canvas.edges, nueva]);

    const serializada = result.edgesBySource["n-inicio"].find((edge) => edge.id === "e-nueva");
    expect(serializada).toEqual({
      id: "e-nueva",
      fromNodeId: "n-inicio",
      toNodeId: "n-fin",
      priority: 10,
      isFallback: false,
      condition: { operator: "always" }
    });
  });
});
