import type { GraphScenario } from "./graphScenarios.js";

/**
 * Los nueve escenarios acordados. Una sola declaración para ambos validadores.
 */
export const GRAPH_SCENARIOS: ReadonlyArray<GraphScenario> = [
  {
    name: "valid flow",
    nodes: [
      { id: "entry", type: "message" },
      { id: "ask", type: "question" },
      { id: "done", type: "end" }
    ],
    edges: [
      { id: "e1", from: "entry", to: "ask", priority: 1 },
      { id: "e2", from: "ask", to: "done", priority: 1 },
      { id: "e3", from: "ask", to: "done", priority: 2, isFallback: true }
    ],
    entryNodeId: "entry",
    backendRejects: false,
    frontendWarns: false
  },
  {
    name: "empty flow",
    nodes: [],
    edges: [],
    entryNodeId: "entry",
    backendRejects: true,
    frontendWarns: true
  },
  {
    name: "missing entry",
    nodes: [
      { id: "orphan", type: "message" },
      { id: "done", type: "end" }
    ],
    edges: [{ id: "e1", from: "orphan", to: "done", priority: 1 }],
    entryNodeId: "no-existe",
    backendRejects: true,
    frontendWarns: true
  },
  {
    name: "invalid edge",
    nodes: [
      { id: "entry", type: "message" },
      { id: "done", type: "end" }
    ],
    edges: [{ id: "e1", from: "entry", to: "fantasma", priority: 1 }],
    entryNodeId: "entry",
    backendRejects: true,
    frontendWarns: true
  },
  {
    name: "unreachable node",
    nodes: [
      { id: "entry", type: "message" },
      { id: "done", type: "end" },
      { id: "isla", type: "message" },
      { id: "isla-end", type: "end" }
    ],
    edges: [
      { id: "e1", from: "entry", to: "done", priority: 1 },
      { id: "e2", from: "isla", to: "isla-end", priority: 1 }
    ],
    entryNodeId: "entry",
    backendRejects: false,
    frontendWarns: true
  },
  {
    name: "dead end",
    nodes: [
      { id: "entry", type: "message" },
      { id: "colgado", type: "message" }
    ],
    edges: [{ id: "e1", from: "entry", to: "colgado", priority: 1 }],
    entryNodeId: "entry",
    backendRejects: true,
    frontendWarns: true
  },
  {
    name: "question without fallback",
    nodes: [
      { id: "entry", type: "question" },
      { id: "done", type: "end" }
    ],
    edges: [{ id: "e1", from: "entry", to: "done", priority: 1 }],
    entryNodeId: "entry",
    backendRejects: true,
    frontendWarns: true
  },
  {
    name: "cycle",
    nodes: [
      { id: "entry", type: "message" },
      { id: "vuelta", type: "message" }
    ],
    edges: [
      { id: "e1", from: "entry", to: "vuelta", priority: 1 },
      { id: "e2", from: "vuelta", to: "entry", priority: 1 }
    ],
    entryNodeId: "entry",
    backendRejects: true,
    frontendWarns: true
  },
  {
    name: "duplicate edge priority",
    nodes: [
      { id: "entry", type: "message" },
      { id: "a", type: "end" },
      { id: "b", type: "end" }
    ],
    edges: [
      { id: "e1", from: "entry", to: "a", priority: 1 },
      { id: "e2", from: "entry", to: "b", priority: 1 }
    ],
    entryNodeId: "entry",
    backendRejects: true,
    frontendWarns: false,
    backendOnly: "validateEdgePriorities — el canvas no comprueba prioridades duplicadas"
  }
];
