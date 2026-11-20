import type { FollowUp } from "../../../domains/crm/domain/FollowUp";
import type { WhatsAppConnection } from "../../../domains/connections/domain/WhatsAppConnection";
import { NotificationSettingsServices } from "../../../domains/notifications/application/NotificationSettingsServices";
import { PushNotifier, type PushEvent } from "../../../domains/notifications/application/PushNotifier";
import type { ReviewSaleEvent } from "../../../domains/sales/application/SaleEvents";
import type { TaskHandler } from "../../../domains/scheduling/application/ports/TaskPorts";
import type { TaskScheduler } from "../../../domains/scheduling/application/TaskScheduler";
import type { ScheduledTask } from "../../../domains/scheduling/domain/ScheduledTask";
import { WebPushSender } from "../../../infrastructure/notifications/WebPushSender";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlPushAudience } from "../../../infrastructure/persistence/sql/SqlPushAudience";
import { SqlPushDevices, SqlPushPreferences } from "../../../infrastructure/persistence/sql/SqlPushDevices";
import { formatMoney } from "../../../contracts/MoneyFormat";
import type { PushConfig } from "../config/loadPushConfig";
import type { BackgroundTasks } from "../http/BackgroundTasks";
import type { InboundListener } from "./composeMessagingServices";

// ---------------------------------------------------------------------------
// composeNotificationPush — los avisos al celular, conectados a los eventos de
// cada módulo SIN que se conozcan: cada módulo avisa «pasó esto» con su gancho
// y aquí se convierte en un aviso. Salen en segundo plano: un aviso nunca
// demora un chat, un flujo ni una pantalla. El de un seguimiento espera su
// hora en la cola de tareas (`notifications.follow_up_due`).
// ---------------------------------------------------------------------------

export const FOLLOW_UP_PUSH_TASK = "notifications.follow_up_due";

export interface PushDependencies {
  readonly sql: SqlClient;
  /** `null`: sin claves VAPID (no se manda nada; la página lo explica). */
  readonly keys: PushConfig | null;
  readonly background: BackgroundTasks;
  readonly scheduler: TaskScheduler;
  readonly onError: (error: unknown, context: Record<string, unknown>) => void;
}

export interface PushModule {
  readonly settings: NotificationSettingsServices;
  /** Un cliente escribió: avisa a quien atiende ese chat. */
  readonly inbound: InboundListener;
  /** Un número conectado se cayó solo (Conexiones). */
  readonly numberDropped: (connection: WhatsAppConnection) => Promise<void>;
  /** Una venta nueva quedó «Por revisar» (Ventas). */
  readonly saleNeedsReview: (tenantId: string, sale: ReviewSaleEvent) => Promise<void>;
  /** Se creó o cambió un seguimiento (CRM): su aviso a la hora. */
  readonly followUpScheduled: (followUp: FollowUp) => Promise<void>;
  readonly handler: TaskHandler;
}

export function composeNotificationPush(deps: PushDependencies): PushModule {
  const devices = new SqlPushDevices(deps.sql);
  const preferences = new SqlPushPreferences(deps.sql);
  const sender = deps.keys ? new WebPushSender(deps.keys) : null;
  const notifier = new PushNotifier({ devices, preferences, audience: new SqlPushAudience(deps.sql), sender, onError: deps.onError });
  // Sin claves no hay nada que mandar: ni se consulta la base.
  const send = (event: PushEvent) => {
    if (sender) deps.background.run(() => notifier.notify(event));
  };

  return {
    settings: new NotificationSettingsServices(devices, preferences, sender),
    inbound: {
      heard: async (tenantId, message) => send({ topic: "chat_message", tenantId, connectionId: message.connectionId, phone: message.phone, kind: message.kind, text: message.text ?? "" })
    },
    numberDropped: async (connection) => send({ topic: "number_disconnected", tenantId: connection.tenantId, connectionId: connection.id }),
    saleNeedsReview: async (tenantId, sale) =>
      send({
        topic: "sale_review",
        tenantId,
        saleId: sale.id,
        customerName: sale.customerName,
        amount: sale.amount !== null && sale.currency ? formatMoney(sale.amount, sale.currency) : null,
        reason: sale.reviewReason,
        recordedBy: sale.recordedBy
      }),
    followUpScheduled: async (followUp) => {
      if (!sender || followUp.doneAt || !followUp.assigneeId) return;
      const dueAt = new Date(followUp.dueAt);
      // Uno creado para una hora que ya pasó no suena: quien lo creó ya lo sabe.
      if (dueAt.getTime() <= Date.now()) return;
      try {
        // Uno por seguimiento: moverlo de hora reemplaza el recordatorio anterior.
        await deps.scheduler.replaceInGroup({
          tenantId: followUp.tenantId,
          kind: FOLLOW_UP_PUSH_TASK,
          groupKey: `push-follow-up:${followUp.id}`,
          dedupeKey: `push-follow-up:${followUp.id}:${followUp.dueAt}`,
          payload: { followUpId: followUp.id, dueAt: followUp.dueAt },
          dueAt,
          maxAttempts: 2
        });
      } catch (error) {
        deps.onError(error, { step: "push.follow_up_schedule", tenantId: followUp.tenantId });
      }
    },
    handler: {
      kind: FOLLOW_UP_PUSH_TASK,
      handle: async (task: ScheduledTask) => {
        const payload = task.payload as { followUpId?: unknown; dueAt?: unknown };
        if (typeof payload.followUpId !== "string" || typeof payload.dueAt !== "string") return;
        // Aquí sí se espera: la tarea termina cuando el aviso salió (o no correspondía).
        await notifier.notify({ topic: "follow_up_due", tenantId: task.tenantId, followUpId: payload.followUpId, dueAt: payload.dueAt });
      }
    }
  };
}
