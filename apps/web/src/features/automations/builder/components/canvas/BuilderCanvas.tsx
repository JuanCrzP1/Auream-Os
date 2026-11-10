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
  useNodesInitialized,
  useReactFlow,
  type Connection,
  type Edge,
  type FinalConnectionState
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { withLabTrail, type LabTrail } from "./labTrail";
import "./lab-trail.css";
import { checkConnection } from "@features/automations/builder/services/connectionRules";
import { nodeTypes } from "./nodeTypes";
import { edgeTypes } from "./edgeTypes";
import { ExpandedNodeOverlay } from "./ExpandedNodeOverlay";
import { FlowReviewPanel } from "../review/FlowReviewPanel";
import type { FlowReview } from "@features/automations/builder/services/reviewFlow";
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
  /** Revisión del flujo que se muestra en la esquina del lienzo. */
  review: FlowReview;
  /**
   * Entrega a la página una función que dice qué punto del flujo está en el
   * centro de la pantalla. La usa la Toolbox para que un bloque añadido con un
   * toque aparezca donde el usuario está mirando (clave en pantallas pequeñas).
   */
  registerViewportCenter?: (getCenter: () => { x: number; y: number }) => void;
  /** Bloques que ilumina el laboratorio de pruebas. */
  labTrail?: LabTrail;
  /** Entrega a la página la función que lleva a un bloque (el laboratorio la usa). */
  registerFocusNode?: (focus: (nodeId: string) => void) => void;
  /** Solo lectura: no se arrastran bloques ni se tiran conexiones (la página además blinda el grafo). */
  readOnly?: boolean;
}

/** Encuadre inicial: algo alejado, con aire alrededor. */
const INITIAL_FIT = { padding: 0.25, maxZoom: 0.8 } as const;

/** Encuadre al ir a un bloque desde la revisión. */
const FOCUS_VIEW = { duration: 420, maxZoom: 1.1, padding: 0.8 } as const;

/** Cuánto se ve el aviso de una conexión rechazada. */
const NOTICE_MS = 3600;

function CanvasInner(props: BuilderCanvasProps) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const surfaceRef = useRef<HTMLDivElement>(null);

  // Encuadre inicial completo. El `fitView` del componente se aplica antes de
  // que React Flow haya medido todos los bloques y en la práctica encuadraba
  // solo el primero (Inicio), dejando el resto fuera de la pantalla. Se repite
  // UNA vez, cuando todos están medidos; después manda el usuario.
  const nodesInitialized = useNodesInitialized();
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current || !nodesInitialized) return;
    framed.current = true;
    void fitView(INITIAL_FIT);
  }, [nodesInitialized, fitView]);
  const { registerViewportCenter } = props;

  useEffect(() => {
    registerViewportCenter?.(() => {
      const rect = surfaceRef.current?.getBoundingClientRect();
      if (!rect) return screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      return screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    });
  }, [registerViewportCenter, screenToFlowPosition]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (notice === null) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Reglas de conexión (docs/architecture/flow-connections.md): React Flow
  // marca el destino como no válido mientras se arrastra.
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => checkConnection(props.nodes, props.edges, connection).ok,
    [props.nodes, props.edges]
  );

  // Al soltar sobre un destino no permitido se explica por qué.
  const onConnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      if (state.isValid || !state.toNode || !state.fromNode) return;
      const result = checkConnection(props.nodes, props.edges, {
        source: state.fromNode.id,
        target: state.toNode.id,
        sourceHandle: state.fromHandle?.id ?? null
      });
      if (!result.ok) setNotice(result.message);
    },
    [props.nodes, props.edges]
  );

  // Ir a un bloque desde la revisión: se encuadra y se selecciona. La
  // selección viaja como cambio de React Flow para que el estado siga teniendo
  // un único dueño (`useCanvasNodes`).
  const { nodes, onNodesChange } = props;
  const focusNode = useCallback(
    (nodeId: string) => {
      onNodesChange(nodes.map((node) => ({ type: "select" as const, id: node.id, selected: node.id === nodeId })));
      void fitView({ ...FOCUS_VIEW, nodes: [{ id: nodeId }] });
    },
    [nodes, onNodesChange, fitView]
  );

  const { registerFocusNode } = props;
  useEffect(() => {
    registerFocusNode?.(focusNode);
  }, [registerFocusNode, focusNode]);
  const shownNodes = useMemo(() => withLabTrail(props.nodes, props.labTrail), [props.nodes, props.labTrail]);

  // Teclado (B13): con un bloque enfocado (Tab), Enter abre su editor.
  // Suprimir/Retroceso ya los borra React Flow; Escape cierra el editor.
  const { onEditNode } = props;
  const onCanvasKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter") return;
      const node = (event.target as HTMLElement).closest<HTMLElement>(".react-flow__node");
      const nodeId = node?.dataset.id;
      if (!nodeId || event.target !== node) return;
      event.preventDefault();
      onEditNode(nodeId);
    },
    [onEditNode]
  );

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
      <div className="builder-canvas-shell__surface" ref={surfaceRef}>
        {notice ? (
          <div className="canvas-connection-notice" role="status">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <circle cx="8" cy="8" r="6.25" />
              <path d="M8 4.75v3.75M8 11h.01" />
            </svg>
            {notice}
          </div>
        ) : null}
        <FlowReviewPanel review={props.review} onFocusNode={focusNode} />
        <ReactFlow<CanvasNode, CanvasEdge>
          aria-label="Lienzo del flujo. Tab recorre los bloques, Enter abre el editor del bloque enfocado y Suprimir lo borra."
          onKeyDown={onCanvasKeyDown}
          fitView
          /* Sin opciones, `fitView` encuadra al 100% y con un único nodo el
             lienzo abre "encima" de él. El tope de 0.8 deja el flujo algo
             alejado y el padding le da aire alrededor. Sólo afecta al encuadre
             inicial: el zoom que elija el usuario después no se toca, y el
             tamaño real de los nodos no cambia. */
          fitViewOptions={INITIAL_FIT}
          /* El límite real de alejamiento interactivo, no el del encuadre
             inicial de arriba. React Flow trae 0.5 por defecto —a mitad de
             tamaño real—, que se queda corto en cuanto la automatización
             crece: un flujo de veinte nodos ya no cabe entero en pantalla y
             hay que desplazarse para verlo. 0.05 deja ver diez veces más
             lienzo. El acercamiento (`maxZoom`) no se toca: se queda en el
             2 por omisión de React Flow, igual que antes. */
          minZoom={0.05}
          snapToGrid
          nodes={shownNodes}
          edges={props.edges}
          nodeTypes={nodeTypes}
          snapGrid={[24, 24]}
          connectionLineType={ConnectionLineType.Bezier}
          connectionLineStyle={{ strokeWidth: 2, strokeDasharray: "6 3" }}
          onNodesChange={props.onNodesChange}
          onEdgesChange={props.onEdgesChange}
          onConnect={props.onConnect}
          nodesDraggable={!props.readOnly}
          nodesConnectable={!props.readOnly}
          isValidConnection={isValidConnection}
          onConnectEnd={onConnectEnd}
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
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{
            /* `deletable` ES el bézier de arriba: `DeletableEdge` monta el
               mismo `BezierEdge` que React Flow usaba para `default` y le
               añade, solo al seleccionarla, el botón de eliminar. El trazo no
               cambia. */
            type: "deletable",
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