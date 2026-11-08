import type { PersistedBuilderWorkspace } from "../../../contracts/BuilderContracts";
import { START_NODE_ID, createStartNode } from "../../../contracts/FlowEntry";

export function buildInitialBuilderWorkspace(tenantId: string, flowKey: string): PersistedBuilderWorkspace {
  const initialSnapshot: PersistedBuilderWorkspace["draft"] = {
    flow: {
      id: flowKey,
      key: flowKey,
      name: "Nueva automatización"
    },
    version: {
      id: `${flowKey}:v1:draft`,
      versionNumber: 1,
      status: "draft",
      entryNodeId: START_NODE_ID
    },
    nodes: {
      [START_NODE_ID]: createStartNode()
    },
    edgesBySource: {}
  };

  return {
    tenantId,
    flowKey,
    draft: initialSnapshot,
    updatedAt: new Date().toISOString(),
    autosaveRevision: 0
  };
}
