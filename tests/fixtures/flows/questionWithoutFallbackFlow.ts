import type { FlowSnapshot } from "../../../contracts/FlowSnapshot.js";

/**
 * Fixture: flujo con nodo question sin fallback.
 */
export const questionWithoutFallbackFlow: FlowSnapshot = {
  flow: {
    id: "flow-no-fallback",
    tenantId: "tenant-test",
    key: "no-fallback",
    name: "Question Sin Fallback",
    currentPublishedVersionId: null
  },
  version: {
    id: "v1",
    tenantId: "tenant-test",
    flowId: "flow-no-fallback",
    versionNumber: 1,
    status: "draft",
    entryNodeId: "node-start"
  },
  nodes: {
    "node-start": {
      id: "node-start",
      tenantId: "tenant-test",
      flowVersionId: "v1",
      type: "start",
      name: "Inicio",
      content: {},
      config: {},
      metadata: {}
    },
    "node-question": {
      id: "node-question",
      tenantId: "tenant-test",
      flowVersionId: "v1",
      type: "question",
      name: "Pregunta sin fallback",
      content: {},
      config: {},
      metadata: {}
    },
    "node-end": {
      id: "node-end",
      tenantId: "tenant-test",
      flowVersionId: "v1",
      type: "end",
      name: "Fin",
      content: {},
      config: {},
      metadata: {}
    }
  },
  edgesBySource: {
    "node-start": [
      {
        id: "edge-start",
        tenantId: "tenant-test",
        flowVersionId: "v1",
        fromNodeId: "node-start",
        toNodeId: "node-question",
        priority: 0,
        isFallback: false,
        condition: { operator: "always" }
      }
    ],
    "node-question": [
      {
        id: "edge-q-end",
        tenantId: "tenant-test",
        flowVersionId: "v1",
        fromNodeId: "node-question",
        toNodeId: "node-end",
        priority: 0,
        isFallback: false,         // NO es fallback
        condition: { operator: "always" }
      }
    ]
  }
};
