import type { PersistedBuilderWorkspace } from "../../../contracts/BuilderContracts";

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
      entryNodeId: "start_message"
    },
    nodes: {
      start_message: {
        id: "start_message",
        type: "message",
        name: "Inicio",
        content: { text: "Inicio del flujo" },
        config: {},
        metadata: { ui: { x: 200, y: 220 } }
      }
    },
    edgesBySource: {}
  };

  return {
    tenantId,
    flowKey,
    draft: initialSnapshot,
    publishedSnapshots: [],
    updatedAt: new Date().toISOString(),
    autosaveRevision: 0
  };
}
