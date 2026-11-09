import type { ConnectionsServices } from "../../composition/composeConnectionsServices";
import type { McpTool } from "../McpTool";

// Números de WhatsApp (permiso «Números de WhatsApp: ver»).

export function connectionTools(services: Pick<ConnectionsServices, "list">): McpTool[] {
  return [
    {
      name: "list_connections",
      title: "Listar números de WhatsApp",
      description: "Los números de WhatsApp de la cuenta: id, nombre, número, estado (conectado o no) y cuántos disparadores tiene.",
      scope: "connections.read",
      readOnly: true,
      inputSchema: { type: "object", properties: {} },
      run: async (_args, { tenantId }) => ({
        connections: (await services.list.execute(tenantId)).map((connection) => ({
          id: connection.id,
          name: connection.name,
          phone: connection.phoneNumber,
          status: connection.status,
          triggers: connection.triggerCount
        }))
      })
    }
  ];
}
