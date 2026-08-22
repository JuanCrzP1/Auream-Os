import type { FlowSnapshot } from "../../../contracts/FlowSnapshot.js";

/**
 * Fixture: flujo con prioridades duplicadas en el mismo nodo.
 */
export const duplicatePriorityFlow: FlowSnapshot = {
  flow: {
    id: "flow-dup-priority",
    tenantId: "tenant-test",
    key: "dup-priority",
    name: "Prioridades Duplicadas",
    currentPublishedVersionId: null
  },
  version: {
    id: "v1",
    tenantId: "tenant-test",
    flowId: "flow-dup-priority",
    versionNumber: 1,
    status: "draft",
    entryNodeId: "node-condition"
  },
  nodes: {
    "node-condition": {
      id: "node-condition",
      tenantId: "tenant-test",
      flowVersionId: "v1",
      type: "condition",
      name: "Condición",
      content: {},
      config: {},
      metadata: {}
    },
    "node-end-a": {
      id: "node-end-a",
      tenantId: "tenant-test",
      flowVersionId: "v1",
      type: "end",
      name: "Fin A",
      content: {},
      config: {},
      metadata: {}
    },
    "node-end-b": {
      id: "node-end-b",
      tenantId: "tenant-test",
      flowVersionId: "v1",
      type: "end",
      name: "Fin B",
      content: {},
      config: {},
      metadata: {}
    }
  },
  edgesBySource: {
    "node-condition": [
      {
        id: "edge-cond-a",
        tenantId: "tenant-test",
        flowVersionId: "v1",
        fromNodeId: "node-condition",
        toNodeId: "node-end-a",
        priority: 0,              // prioridad duplicada
        isFallback: false,
        condition: { operator: "eq", fact: "context.score", value: "high" }
      },
      {
        id: "edge-cond-b",
        tenantId: "tenant-test",
        flowVersionId: "v1",
        fromNodeId: "node-condition",
        toNodeId: "node-end-b",
        priority: 0,              // prioridad duplicada
        isFallback: true,
        condition: { operator: "always" }
      }
    ]
  }
};
