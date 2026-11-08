import type { PersistedBuilderWorkspace } from "@contracts/BuilderContracts";
import { START_NODE_ID, createStartNode } from "@contracts/FlowEntry";

/**
 * Workspace local de respaldo cuando la API no está accesible.
 *
 * El `tenantId` llega desde la sesión autenticada: nunca se inventa aquí.
 * Este workspace vive sólo en memoria y no se ha persistido en el servidor.
 */
export function createLocalBuilderWorkspace(flowKey: string, tenantId: string): PersistedBuilderWorkspace {
  return {
    tenantId,
    flowKey,
    draft: {
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
    },
    updatedAt: new Date().toISOString(),
    autosaveRevision: 0
  };
}
