import type { FlowSnapshot } from "../../../contracts/FlowSnapshot.js";

/**
 * Fixture: flujo con ciclo infinito (todos los edges son "always").
 * Ningún nodo puede salir del ciclo.
 */
export const infiniteCycleFlow: FlowSnapshot = {
  flow: {
    id: "flow-cycle",
    tenantId: "tenant-test",
    key: "cycle",
    name: "Ciclo Infinito",
    currentPublishedVersionId: null
  },
  version: {
    id: "v1",
    tenantId: "tenant-test",
    flowId: "flow-cycle",
    versionNumber: 1,
    status: "draft",
    entryNodeId: "node-a"
  },
  nodes: {
    "node-a": {
      id: "node-a",
      tenantId: "tenant-test",
      flowVersionId: "v1",
      type: "message",
      name: "Nodo A",
      content: {},
      config: {},
      metadata: {}
    },
    "node-b": {
      id: "node-b",
      tenantId: "tenant-test",
      flowVersionId: "v1",
      type: "message",
      name: "Nodo B",
      content: {},
      config: {},
      metadata: {}
    }
  },
  edgesBySource: {
    "node-a": [
      {
        id: "edge-a-b",
        tenantId: "tenant-test",
        flowVersionId: "v1",
        fromNodeId: "node-a",
        toNodeId: "node-b",
        priority: 0,
        isFallback: false,
        condition: { operator: "always" }
      }
    ],
    "node-b": [
      {
        id: "edge-b-a",
        tenantId: "tenant-test",
        flowVersionId: "v1",
        fromNodeId: "node-b",
        toNodeId: "node-a",
        priority: 0,
        isFallback: false,
        condition: { operator: "always" }
      }
    ]
  }
};
