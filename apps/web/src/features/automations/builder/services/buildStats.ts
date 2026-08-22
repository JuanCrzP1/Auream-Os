import type { CanvasEdge, CanvasNode } from "../types/canvas";

export interface BuilderStats {
  nodes: number;
  edges: number;
  terminalNodes: number;
  fallbackEdges: number;
}

export function buildStats(nodes: CanvasNode[], edges: CanvasEdge[]): BuilderStats {
  return {
    nodes: nodes.length,
    edges: edges.length,
    terminalNodes: nodes.filter((node) => node.data.isTerminal).length,
    fallbackEdges: edges.filter((edge) => edge.data?.isFallback).length
  };
}