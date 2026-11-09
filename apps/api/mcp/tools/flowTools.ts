import type { ApiServices } from "../../composition/composeBuilderServices";
import { NotFoundError } from "../../../../platform/observability/errors/NotFoundError";
import type { McpTool } from "../McpTool";

// Flujos (permiso «Flujos: ver»): listarlos y leer uno con sus bloques y conexiones.

type FlowServices = Pick<ApiServices, "listAutomationsService" | "getWorkspaceService">;

export function flowTools(services: FlowServices): McpTool[] {
  return [
    {
      name: "list_flows",
      title: "Listar flujos",
      description: "Los flujos de la cuenta: id, clave, nombre, estado (activo, borrador, archivado) y cuántos bloques tiene.",
      scope: "flows.read",
      readOnly: true,
      inputSchema: { type: "object", properties: {} },
      run: async (_args, { tenantId }) => {
        const { flows } = await services.listAutomationsService.execute(tenantId);
        return { flows: flows.map(({ flow, graphSummary }) => ({ id: flow.id, key: flow.key, name: flow.name, status: flow.status, blocks: graphSummary.nodeCount })) };
      }
    },
    {
      name: "get_flow",
      title: "Ver un flujo",
      description: "Un flujo con sus bloques (tipo, nombre y configuración) y las conexiones entre ellos (de qué salida a qué bloque). Acepta el id o la clave de list_flows.",
      scope: "flows.read",
      readOnly: true,
      inputSchema: { type: "object", properties: { flow_id: { type: "string", description: "Id o clave del flujo (de list_flows)." } }, required: ["flow_id"] },
      run: async (args, { tenantId }) => {
        const wanted = String(args["flow_id"]);
        const { flows } = await services.listAutomationsService.execute(tenantId);
        const flow = flows.map((item) => item.flow).find((item) => item.id === wanted || item.key === wanted);
        if (!flow) throw new NotFoundError("Ese flujo no existe en la cuenta. Usa list_flows para ver los ids.");
        const workspace = await services.getWorkspaceService.execute(tenantId, flow.key);
        const draft = workspace?.draft;
        return {
          id: flow.id,
          key: flow.key,
          name: flow.name,
          status: flow.status,
          entryBlockId: draft?.version.entryNodeId ?? null,
          blocks: Object.values(draft?.nodes ?? {}).map((node) => ({ id: node.id, type: node.type, name: node.name, config: node.config })),
          connections: Object.values(draft?.edgesBySource ?? {}).flat().map((edge) => ({ from: edge.fromNodeId, to: edge.toNodeId, ...(edge.fromOutput ? { output: edge.fromOutput } : {}) }))
        };
      }
    }
  ];
}
