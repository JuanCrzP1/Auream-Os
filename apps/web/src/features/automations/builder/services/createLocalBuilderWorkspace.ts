import type { PersistedBuilderWorkspace } from "@contracts/BuilderContracts";

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
    },
    publishedSnapshots: [],
    updatedAt: new Date().toISOString(),
    autosaveRevision: 0
  };
}
