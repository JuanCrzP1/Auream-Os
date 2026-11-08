import type { GraphScenario } from "./graphScenarios.js";

/**
 * Escenarios acordados. Una sola declaración para ambos validadores.
 * Reglas de conexión: docs/architecture/flow-connections.md.
 */
export const GRAPH_SCENARIOS: ReadonlyArray<GraphScenario> = [
  {
    name: "valid flow",
    nodes: [
      { id: "entry", type: "start" },
      { id: "ask", type: "question" },
      { id: "done", type: "end" }
    ],
    edges: [
      { id: "e1", from: "entry", to: "ask", priority: 1 },
      { id: "e2", from: "ask", to: "done", priority: 1, fromOutput: "respuesta" },
      { id: "e3", from: "ask", to: "done", priority: 2, fromOutput: "tiempo-agotado" }
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
      { id: "entry", type: "start" },
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
      { id: "entry", type: "start" },
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
    // Cualquier bloque puede ser el último: el flujo termina ahí (como en Leona).
    name: "a message can be the last block",
    nodes: [
      { id: "entry", type: "start" },
      { id: "despedida", type: "message" }
    ],
    edges: [{ id: "e1", from: "entry", to: "despedida", priority: 1 }],
    entryNodeId: "entry",
    backendRejects: false,
    frontendWarns: false
  },
  {
    // Un inicio sin nada detrás es un flujo que no hace nada.
    name: "start leading nowhere",
    nodes: [{ id: "entry", type: "start" }],
    edges: [],
    entryNodeId: "entry",
    backendRejects: true,
    frontendWarns: true
  },
  {
    name: "wait with a single exit (no limit) is valid",
    nodes: [
      { id: "entry", type: "start" },
      { id: "ask", type: "question" },
      { id: "done", type: "end" }
    ],
    edges: [
      { id: "e1", from: "entry", to: "ask", priority: 1 },
      { id: "e2", from: "ask", to: "done", priority: 1, fromOutput: "respuesta" }
    ],
    entryNodeId: "entry",
    backendRejects: false,
    frontendWarns: false
  },
  {
    name: "cycle through a waiting block is allowed",
    nodes: [
      { id: "entry", type: "start" },
      { id: "ask", type: "question" },
      { id: "again", type: "message" },
      { id: "done", type: "end" }
    ],
    edges: [
      { id: "e1", from: "entry", to: "ask", priority: 1 },
      { id: "e2", from: "ask", to: "done", priority: 1, fromOutput: "respuesta" },
      { id: "e3", from: "ask", to: "again", priority: 2, fromOutput: "tiempo-agotado" },
      { id: "e4", from: "again", to: "ask", priority: 1 }
    ],
    entryNodeId: "entry",
    backendRejects: false,
    frontendWarns: false
  },
  {
    name: "two connections from a single-output block",
    nodes: [
      { id: "entry", type: "start" },
      { id: "step", type: "tags" },
      { id: "a", type: "end" },
      { id: "b", type: "end" }
    ],
    edges: [
      { id: "e1", from: "entry", to: "step", priority: 1 },
      { id: "e2", from: "step", to: "a", priority: 1 },
      { id: "e3", from: "step", to: "b", priority: 2 }
    ],
    entryNodeId: "entry",
    backendRejects: true,
    frontendWarns: true
  },
  {
    name: "two connections from the same named output",
    nodes: [
      { id: "entry", type: "start" },
      { id: "ask", type: "question" },
      { id: "a", type: "end" },
      { id: "b", type: "end" }
    ],
    edges: [
      { id: "e1", from: "entry", to: "ask", priority: 1 },
      { id: "e2", from: "ask", to: "a", priority: 1, fromOutput: "respuesta" },
      { id: "e3", from: "ask", to: "b", priority: 2, fromOutput: "respuesta" }
    ],
    entryNodeId: "entry",
    backendRejects: false,
    frontendWarns: true
  },
  {
    name: "cycle",
    nodes: [
      { id: "entry", type: "start" },
      { id: "ida", type: "message" },
      { id: "vuelta", type: "message" }
    ],
    edges: [
      { id: "e1", from: "entry", to: "ida", priority: 1 },
      { id: "e2", from: "ida", to: "vuelta", priority: 1 },
      { id: "e3", from: "vuelta", to: "ida", priority: 1 }
    ],
    entryNodeId: "entry",
    backendRejects: true,
    frontendWarns: true
  },
  {
    name: "duplicate edge priority",
    nodes: [
      { id: "entry", type: "start" },
      { id: "a", type: "end" },
      { id: "b", type: "end" }
    ],
    edges: [
      { id: "e1", from: "entry", to: "a", priority: 1 },
      { id: "e2", from: "entry", to: "b", priority: 1 }
    ],
    entryNodeId: "entry",
    backendRejects: true,
    // El builder lo señala por otra regla: dos conexiones desde la salida única.
    frontendWarns: true
  },
  {
    name: "entry is not the start block",
    nodes: [
      { id: "entry", type: "message" },
      { id: "done", type: "end" }
    ],
    edges: [{ id: "e1", from: "entry", to: "done", priority: 1 }],
    entryNodeId: "entry",
    backendRejects: true,
    frontendWarns: true
  },
  {
    name: "connection into the start block",
    nodes: [
      { id: "entry", type: "start" },
      { id: "ask", type: "question" },
      { id: "done", type: "end" }
    ],
    edges: [
      { id: "e1", from: "entry", to: "ask", priority: 1 },
      { id: "e2", from: "ask", to: "done", priority: 1, fromOutput: "respuesta" },
      { id: "e3", from: "ask", to: "entry", priority: 2, fromOutput: "tiempo-agotado" }
    ],
    entryNodeId: "entry",
    backendRejects: true,
    frontendWarns: true
  },
  {
    name: "a second start block",
    nodes: [
      { id: "entry", type: "start" },
      { id: "otro", type: "start" },
      { id: "done", type: "end" }
    ],
    edges: [
      { id: "e1", from: "entry", to: "done", priority: 1 },
      { id: "e2", from: "otro", to: "done", priority: 1 }
    ],
    entryNodeId: "entry",
    backendRejects: true,
    frontendWarns: true
  }
];
