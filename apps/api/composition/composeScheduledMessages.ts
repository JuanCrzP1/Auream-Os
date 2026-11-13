import type { ConversationRecorder } from "../../../domains/conversations/application/ConversationRecorder";
import type { ConversationRepository } from "../../../domains/conversations/application/ConversationRepository";
import type { ConversationSender } from "../../../domains/conversations/application/ports/ConversationPorts";
import { ScheduledMessageDispatcher } from "../../../domains/conversations/application/ScheduledMessageDispatcher";
import { ScheduledMessageService } from "../../../domains/conversations/application/ScheduledMessageService";
import type { TaskScheduler } from "../../../domains/scheduling/application/TaskScheduler";
import type { TenantResolver } from "../../../platform/tenancy/application/TenantResolver";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlScheduledMessageRepository } from "../../../infrastructure/persistence/sql/SqlScheduledMessageRepository";
import { SchedulerScheduledMessageAlarm, ScheduledMessageTaskHandler } from "./scheduledMessageTaskAdapters";

// ---------------------------------------------------------------------------
// Mensajes programados de los chats: el servicio de la pantalla y el
// manejador de la cola que los envía a su hora. Envían por el mismo número y
// quedan en el mismo hilo que una respuesta del asesor.
// ---------------------------------------------------------------------------

export interface ScheduledMessages {
  readonly service: ScheduledMessageService;
  readonly handler: ScheduledMessageTaskHandler;
}

export function composeScheduledMessages(deps: {
  readonly sql: SqlClient;
  readonly scheduler: TaskScheduler;
  readonly chats: Pick<ConversationRepository, "findById">;
  readonly sender: ConversationSender;
  readonly recorder: Pick<ConversationRecorder, "recordOutbound">;
  /** La zona horaria de cada empresa (la de Empresa; si no eligió una, la de la plataforma). */
  readonly tenants: TenantResolver;
}): ScheduledMessages {
  const repository = new SqlScheduledMessageRepository(deps.sql);
  const dispatcher = new ScheduledMessageDispatcher(repository, deps.chats, deps.sender, deps.recorder);
  const timeZone = { of: async (tenantId: string) => (await deps.tenants.resolve(tenantId)).timezone };
  return {
    service: new ScheduledMessageService(repository, deps.chats, dispatcher, new SchedulerScheduledMessageAlarm(deps.scheduler), timeZone),
    handler: new ScheduledMessageTaskHandler(dispatcher)
  };
}
