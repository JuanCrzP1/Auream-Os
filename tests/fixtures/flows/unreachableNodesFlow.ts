import type { FlowSnapshot } from "../../../contracts/FlowSnapshot.js";

/**
 * Fixture: flujo con nodos inalcanzables desde el entry.
 */
export const unreachableNodesFlow: FlowSnapshot = {
  flow: {
    id: "flow-unreachable",
    tenantId: "tenant-test",
    key: "unreachable",
    name: "Nodos Inalcanzables",
    currentPublishedVersionId: null
  },
  version: {
    id: "v1",
    tenantId: "tenant-test",
    flowId: "flow-unreachable",
    versionNumber: 1,
    status: "draft",
    entryNodeId: "node-entry"
  },
  nodes: {
    "node-entry": {
      id: "node-entry",
      tenantId: "tenant-test",
      flowVersionId: "v1",
      type: "message",
      name: "Entry",
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
    },
    "node-orphan": {
      id: "node-orphan",
      tenantId: "tenant-test",
      flowVersionId: "v1",
      type: "message",
      name: "Nodo Huérfano",
      content: {},
      config: {},
      metadata: {}
    }
  },
  edgesBySource: {
    "node-entry": [
      {
        id: "edge-entry-end",
        tenantId: "tenant-test",
        flowVersionId: "v1",
        fromNodeId: "node-entry",
        toNodeId: "node-end",
        priority: 0,
        isFallback: false,
        condition: { operator: "always" }
      }
    ],
    "node-orphan": [
      {
        id: "edge-orphan-end",
        tenantId: "tenant-test",
        flowVersionId: "v1",
        fromNodeId: "node-orphan",
        toNodeId: "node-end",
        priority: 0,
        isFallback: false,
        condition: { operator: "always" }
      }
    ]
  }
};
