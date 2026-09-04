import "./builder-canvas.css";
import "./flow-node.css";
// Overrides de React Flow, uno por superficie. Estaban los cuatro en un
// `react-flow-overrides.css` que ya se había convertido en el archivo donde
// caía cualquier parche del lienzo, con reglas muertas y colores fuera del
// tema mezclados entre superficies que no tienen nada que ver entre sí.
import "./canvas-surface.css";
import "./canvas-edges.css";
import "./canvas-controls.css";
import "./canvas-minimap.css";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  MiniMap,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection
} from "@xyflow/react";
import { useCallback } from "react";
import { nodeTypes } from "./nodeTypes";
import { ExpandedNodeOverlay } from "./ExpandedNodeOverlay";
import type { CanvasEdge, CanvasNode } from "@features/automations/builder/types/canvas";
import type { NodeType } from "@contracts/FlowSnapshot";
import {
  EDGE_GRADIENT_ID,
  EDGE_GRADIENT_START,
  EDGE_GRADIENT_END
} from "@features/automations/builder/services/buildEdgePresentation";
import { resolveTool } from "@features/automations/builder/tools/registry";

interface BuilderCanvasProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  onNodesChange: OnNodesChange<CanvasNode>;
  onEdgesChange: OnEdgesChange<CanvasEdge>;
  onConnect: (connection: Connection) => void;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onEditNode: (nodeId: string | null) => void;
  onDropNode: (type: NodeType, position: { x: number; y: number }) => void;
  /** Clic en el lienzo vacío: el gesto que ya deselecciona, cierra también el
   *  nodo que estuviera abierto. */
  onPaneClick: () => void;
}

function CanvasInner(props: BuilderCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow") as NodeType;
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      props.onDropNode(type, position);
    },
    [screenToFlowPosition, props]
  );

  return (
    <div
      className="builder-canvas-shell"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {/* Degradado de las conexiones. Un `<defs>` sin dimensiones: no ocupa
          layout y las aristas lo referencian por id desde su trazo. Se declara
          una sola vez para todo el lienzo en lugar de por arista. */}
      <svg width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={EDGE_GRADIENT_ID} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={EDGE_GRADIENT_START} />
            <stop offset="100%" stopColor={EDGE_GRADIENT_END} />
          </linearGradient>
        </defs>
      </svg>
      <div className="builder-canvas-shell__surface">
        <ReactFlow<CanvasNode, CanvasEdge>
          fitView
          /* Sin opciones, `fitView` encuadra al 100% y con un único nodo el
             lienzo abre "encima" de él. El tope de 0.8 deja el flujo algo
             alejado y el padding le da aire alrededor. Sólo afecta al encuadre
             inicial: el zoom que elija el usuario después no se toca, y el
             tamaño real de los nodos no cambia. */
          fitViewOptions={{ padding: 0.25, maxZoom: 0.8 }}
          snapToGrid
          nodes={props.nodes}
          edges={props.edges}
          nodeTypes={nodeTypes}
          snapGrid={[24, 24]}
          connectionLineType={ConnectionLineType.Bezier}
          connectionLineStyle={{ strokeWidth: 2, strokeDasharray: "6 3" }}
          onNodesChange={props.onNodesChange}
          onEdgesChange={props.onEdgesChange}
          onConnect={props.onConnect}
          onNodeClick={(_event, node) => props.onSelectNode(node.id)}
          onNodeDoubleClick={(_event, node) => props.onEditNode(node.id)}
          onEdgeClick={(_event, edge) => props.onSelectEdge(edge.id)}
          onPaneClick={() => {
            props.onSelectNode(null);
            props.onSelectEdge(null);
            props.onPaneClick();
          }}
          /* `default` es el edge bézier de React Flow: curva orgánica cuyos
             puntos de control se recalculan a partir de la posición real de
             los handles, así que sigue a los nodos al moverlos y se comporta
             igual hacia cualquier dirección. `smoothstep` dibujaba tramos
             ortogonales, que leen como esquema técnico y no como cuerda. */
          defaultEdgeOptions={{
            type: "default",
            style: { strokeWidth: 2 }
          }}
          proOptions={{ hideAttribution: true }}
        >
          {/* Cada nodo se pinta con el color de su herramienta, el mismo que
              lleva en el lienzo: el minimapa se lee como una miniatura del
              flujo y no como un bloque anónimo.

              La superficie (fondo, velo del viewport y su contorno) NO se pasa
              por props: es estilo y vive en `canvas-minimap.css`. Además
              las props de React Flow ocupan el tramo de máxima prioridad de sus
              variables, así que fijarlas aquí dejaría a la hoja sin capacidad
              de decidir el tema. */}
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) => resolveTool(String(node.data?.nodeType ?? "")).colors.header}
            nodeStrokeWidth={0}
            nodeBorderRadius={3}
            /* El tamaño va aquí y no en CSS: React Flow dimensiona con esto
               también el SVG interno, así que el cálculo de pan y zoom sigue
               cuadrando. Reducirlo sólo por CSS recortaba el contenido. */
            style={{ width: 168, height: 116 }}
          />
          <Controls showInteractive={false} />
          <Background
            gap={28}
            size={1.5}
            variant={BackgroundVariant.Dots}
          />
        </ReactFlow>
        {/* El editor de un nodo abierto. HERMANO de `<ReactFlow>`, nunca
            hijo: dentro heredaría el `transform` de `.react-flow__viewport`
            —el del pan/zoom— y dejaría de poder anclarse al viewport real
            del navegador. No es una capa del lienzo — ver
            `ExpandedNodeOverlay`. */}
        <ExpandedNodeOverlay />
      </div>
    </div>
  );
}

export function BuilderCanvas(props: BuilderCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}