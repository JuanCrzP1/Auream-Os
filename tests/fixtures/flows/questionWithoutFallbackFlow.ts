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
    entryNodeId: "node-question"
  },
  nodes: {
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
