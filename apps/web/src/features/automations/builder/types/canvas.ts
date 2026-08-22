import type { Edge, Node } from "@xyflow/react";
import type { NodeType, BuilderFlowEdge } from "@contracts/FlowSnapshot";

export type FlowNodeData = Record<string, unknown> & {
  nodeType: NodeType;
  title: string;
  preview: string;
  configSummary: string;
  isEntry: boolean;
  isTerminal: boolean;
  content: Record<string, unknown>;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type FlowEdgeData = Record<string, unknown> & {
  priority: number;
  isFallback: boolean;
  label: string;
  condition: BuilderFlowEdge["condition"];
};

export type CanvasNode = Node<FlowNodeData, "flowNode">;
export type CanvasEdge = Edge<FlowEdgeData>;