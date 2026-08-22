import type { FlowSnapshot, FlowNode, FlowEdge, NodeType } from "../../../contracts/FlowSnapshot.js";

/**
 * Escenarios canónicos de validación de grafo.
 *
 * Cada escenario se declara UNA vez y se materializa en las dos formas que
 * manejan los dos validadores:
 *
 *   backend  → FlowSnapshot            (domains/automations/validation)
 *   frontend → nodos/edges del canvas  (features/automations/builder)
 *
 * `expected` declara el veredicto acordado. Si una de las dos implementaciones
 * cambia una regla por su cuenta, el test de paridad falla.
 */

const TENANT = "tenant-test";
const VERSION = "v1";

export interface ScenarioNode {
  readonly id: string;
  readonly type: NodeType;
  readonly isEntry?: boolean;
}

export interface ScenarioEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly priority?: number;
  readonly isFallback?: boolean;
}

export interface GraphScenario {
  readonly name: string;
  readonly nodes: ReadonlyArray<ScenarioNode>;
  readonly edges: ReadonlyArray<ScenarioEdge>;
  readonly entryNodeId: string;
  /** Veredicto acordado: ¿el backend debe rechazar la publicación? */
  readonly backendRejects: boolean;
  /** ¿El builder debe avisar al usuario (error o warning)? */
  readonly frontendWarns: boolean;
  /**
   * Regla que sólo implementa el backend. El frontend no la cubre y eso está
   * aceptado: el backend es la autoridad final de publicación.
   */
  readonly backendOnly?: string;
}

const TERMINAL: ReadonlySet<NodeType> = new Set<NodeType>(["end"]);

export function toFlowSnapshot(scenario: GraphScenario): FlowSnapshot {
  const nodes: Record<string, FlowNode> = {};

  for (const node of scenario.nodes) {
    nodes[node.id] = {
      id: node.id,
      tenantId: TENANT,
      flowVersionId: VERSION,
      type: node.type,
      name: node.id,
      content: {},
      config: {},
      metadata: {}
    };
  }

  const edgesBySource: Record<string, FlowEdge[]> = {};

  for (const edge of scenario.edges) {
    const list = edgesBySource[edge.from] ?? [];
    list.push({
      id: edge.id,
      tenantId: TENANT,
      flowVersionId: VERSION,
      fromNodeId: edge.from,
      toNodeId: edge.to,
      priority: edge.priority ?? 1,
      isFallback: edge.isFallback ?? false,
      condition: { operator: "always" }
    });
    edgesBySource[edge.from] = list;
  }

  return {
    flow: {
      id: "flow-scenario",
      tenantId: TENANT,
      key: "scenario",
      name: scenario.name,
      currentPublishedVersionId: null
    },
    version: {
      id: VERSION,
      tenantId: TENANT,
      flowId: "flow-scenario",
      versionNumber: 1,
      status: "draft",
      entryNodeId: scenario.entryNodeId
    },
    nodes,
    edgesBySource
  };
}

/** Materializa el escenario en la forma mínima que consume el validador del canvas. */
export function toCanvasGraph(scenario: GraphScenario) {
  const nodes = scenario.nodes.map((node) => ({
    id: node.id,
    type: "flowNode" as const,
    position: { x: 0, y: 0 },
    data: {
      nodeType: node.type,
      title: node.id,
      preview: "",
      configSummary: "",
      isEntry: node.id === scenario.entryNodeId,
      isTerminal: TERMINAL.has(node.type),
      content: {},
      config: {},
      metadata: {}
    }
  }));

  const edges = scenario.edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    data: {
      priority: edge.priority ?? 1,
      isFallback: edge.isFallback ?? false,
      label: "",
      condition: { operator: "always" as const }
    }
  }));

  return { nodes, edges };
}
