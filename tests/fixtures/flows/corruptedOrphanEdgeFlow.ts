import type { FlowSnapshot } from "../../../contracts/FlowSnapshot.js";

/**
 * Fixture: flujo con edge que apunta a nodo borrado.
 * Replica exactamente la corrupción existente en data/builder-workspaces/test-tenant/lead-capture.json
 */
export const corruptedOrphanEdgeFlow: FlowSnapshot = {
  flow: {
    id: "flow-corrupted",
    tenantId: "tenant-test",
    key: "corrupted",
    name: "Corrupted (orphan edge)",
    currentPublishedVersionId: null
  },
  version: {
    id: "v1",
    tenantId: "tenant-test",
    flowId: "flow-corrupted",
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
      name: "Inicio",
      content: {},
      config: {},
      metadata: {}
    }
    // "node-deleted" fue eliminado pero el edge sigue apuntando a él
  },
  edgesBySource: {
    "node-entry": [
      {
        id: "edge-orphan",
        tenantId: "tenant-test",
        flowVersionId: "v1",
        fromNodeId: "node-entry",
        toNodeId: "node-deleted",  // nodo inexistente
        priority: 0,
        isFallback: false,
        condition: { operator: "always" }
      }
    ]
  }
};
