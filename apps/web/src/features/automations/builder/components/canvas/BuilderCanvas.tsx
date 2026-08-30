import "./builder-canvas.css";
import "./flow-node.css";
import "./react-flow-overrides.css";
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
import type { CanvasEdge, CanvasNode } from "@features/automations/builder/types/canvas";
import type { NodeType } from "@contracts/FlowSnapshot";

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
      <div className="builder-canvas-shell__surface">
        <ReactFlow<CanvasNode, CanvasEdge>
          fitView
          snapToGrid
          nodes={props.nodes}
          edges={props.edges}
          nodeTypes={nodeTypes}
          snapGrid={[24, 24]}
          connectionLineType={ConnectionLineType.SmoothStep}
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
          }}
          defaultEdgeOptions={{
            type: "smoothstep",
            style: { strokeWidth: 2, strokeDasharray: "6 3" }
          }}
          proOptions={{ hideAttribution: true }}
        >
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
          <Background
            gap={28}
            size={1.5}
            variant={BackgroundVariant.Dots}
          />
        </ReactFlow>
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