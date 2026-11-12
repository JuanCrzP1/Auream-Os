import type { ApiConfig } from "../config/loadApiConfig";
import type { SimulatorTools } from "../routes/routeSimulatorTools";
import type { TaskScheduler } from "../../../domains/scheduling/application/TaskScheduler";
import type { ConnectionChannelServices } from "../../../domains/connections/application/ConnectionChannelServices";
import { conversationKeyFor } from "../../../domains/messaging/application/HandleInboundMessageService";
import { flowTimerGroup } from "../../../domains/messaging/application/FlowTimerService";

// ---------------------------------------------------------------------------
// Herramientas del WhatsApp simulado (solo desarrollo). Une las orillas sin
// que los dominios se conozcan: el número (conexiones), el chat (mensajería)
// y la cola de tareas (scheduling). Sin simulador: `undefined` (la ruta no existe).
// ---------------------------------------------------------------------------

export function composeSimulatorTools(
  config: Pick<ApiConfig, "whatsappSimulator">,
  channel: Pick<ConnectionChannelServices, "authenticate">,
  scheduler: Pick<TaskScheduler, "advanceGroup">
): SimulatorTools | undefined {
  if (!config.whatsappSimulator) return undefined;
  return {
    authenticate: async (connectionId, token) => {
      if (!token) return null;
      const connection = await channel.authenticate(connectionId, token).catch(() => null);
      return connection ? { tenantId: connection.tenantId } : null;
    },
    advanceChat: (tenantId, connectionId, phone) => scheduler.advanceGroup(tenantId, flowTimerGroup(conversationKeyFor(connectionId, phone)))
  };
}
