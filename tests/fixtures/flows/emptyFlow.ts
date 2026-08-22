import type { FlowSnapshot } from "../../../contracts/FlowSnapshot.js";

/**
 * Fixture: flujo vacío. Debe fallar validación.
 */
export const emptyFlow: FlowSnapshot = {
  flow: {
    id: "flow-empty",
    tenantId: "tenant-test",
    key: "empty",
    name: "Empty",
    currentPublishedVersionId: null
  },
  version: {
    id: "v1",
    tenantId: "tenant-test",
    flowId: "flow-empty",
    versionNumber: 1,
    status: "draft",
    entryNodeId: "node-missing"
  },
  nodes: {},
  edgesBySource: {}
};
