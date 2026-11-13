import { randomUUID } from "node:crypto";
import type { BusinessDataReader } from "../../../flow-engine/ports/BusinessDataReader";
import type { ApiConfig } from "../config/loadApiConfig";
import { AudienceServices } from "../../../domains/broadcasts/application/AudienceServices";
import { BroadcastDispatcher } from "../../../domains/broadcasts/application/BroadcastDispatcher";
import type { BroadcastEngine } from "../../../domains/broadcasts/application/BroadcastEngine";
import { BroadcastLauncher } from "../../../domains/broadcasts/application/BroadcastLauncher";
import type { BroadcastSender, FlowDirectory, NumberDirectory } from "../../../domains/broadcasts/application/BroadcastPorts";
import { BroadcastServices } from "../../../domains/broadcasts/application/BroadcastServices";
import { OptOutListener } from "../../../domains/broadcasts/application/OptOutListener";
import type { FlowCatalog } from "../../../domains/connections/application/ports/FlowCatalog";
import type { ListConnectionsService } from "../../../domains/connections/application/ConnectionServices";
import type { OutreachService } from "../../../domains/messaging/application/OutreachService";
import type { TaskHandler } from "../../../domains/scheduling/application/ports/TaskPorts";
import type { TaskScheduler } from "../../../domains/scheduling/application/TaskScheduler";
import { SqlBroadcastAudience } from "../../../infrastructure/persistence/sql/SqlBroadcastAudience";
import { SqlBroadcastRecipients } from "../../../infrastructure/persistence/sql/SqlBroadcastRecipients";
import { SqlBroadcastRepository } from "../../../infrastructure/persistence/sql/SqlBroadcastRepository";
import { SqlBroadcastResults } from "../../../infrastructure/persistence/sql/SqlBroadcastResults";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlSavedAudiences } from "../../../infrastructure/persistence/sql/SqlSavedAudiences";
import { SqlTenantResolver } from "../../../infrastructure/persistence/sql/SqlTenantResolver";
import { broadcastTaskHandlers, SchedulerBroadcastTicker } from "./broadcastTaskAdapters";

// ---------------------------------------------------------------------------
// composeBroadcastServices — Difusiones sobre PostgreSQL y la cola de tareas.
// Habla con Mensajería (enviar y que quede en la bandeja), Conexiones (los
// números y el catálogo de flujos) SOLO por sus puertos; aquí se decide quién
// los cumple.
// ---------------------------------------------------------------------------

export interface BroadcastDependencies {
  readonly config: ApiConfig;
  readonly sql: SqlClient;
  readonly scheduler: TaskScheduler;
  readonly outreach: OutreachService;
  readonly connections: { readonly list: Pick<ListConnectionsService, "execute">; readonly flows: FlowCatalog };
  /** Datos del negocio (`{g_…}`) para el texto de las difusiones. */
  readonly businessValues?: BusinessDataReader;
  readonly onError: (error: unknown, context: Record<string, unknown>) => void;
}

export interface BroadcastModule {
  readonly broadcasts: BroadcastServices;
  readonly audiences: AudienceServices;
  /** Escucha los mensajes entrantes: «SALIR» saca al cliente de las difusiones. */
  readonly optOuts: OptOutListener;
  readonly handlers: ReadonlyArray<TaskHandler>;
}

export function composeBroadcastServices(deps: BroadcastDependencies): BroadcastModule {
  const { sql } = deps;
  const audience = new SqlBroadcastAudience(sql);
  const tenants = new SqlTenantResolver(sql, deps.config.defaultTimezone);
  const engine: BroadcastEngine = {
    broadcasts: new SqlBroadcastRepository(sql),
    recipients: new SqlBroadcastRecipients(sql),
    audience,
    optOuts: audience,
    results: new SqlBroadcastResults(sql),
    sender: outreachSender(deps.outreach),
    numbers: numberDirectory(deps.connections.list),
    flows: flowDirectory(deps.connections.flows),
    ticker: new SchedulerBroadcastTicker(deps.scheduler, sql),
    timezoneOf: async (tenantId) => (await tenants.resolve(tenantId)).timezone,
    now: () => new Date(),
    random: Math.random,
    newId: randomUUID,
    ...(deps.businessValues ? { business: (tenantId: string) => deps.businessValues!.values(tenantId) } : {})
  };
  const launcher = new BroadcastLauncher(engine);
  const dispatcher = new BroadcastDispatcher(engine);
  return {
    broadcasts: new BroadcastServices(engine, launcher),
    audiences: new AudienceServices(engine, new SqlSavedAudiences(sql)),
    optOuts: new OptOutListener(audience, undefined, (error) => deps.onError(error, { step: "opt_out" })),
    handlers: broadcastTaskHandlers(launcher, dispatcher)
  };
}

/** Un flujo borrado o archivado no se puede enviar a nadie: la difusión se pausa. */
function outreachSender(outreach: OutreachService): BroadcastSender {
  return {
    sendFlow: async (tenantId, target, automationId) => {
      try {
        return await outreach.sendFlow(tenantId, target, automationId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo iniciar el flujo.";
        return { ok: false, providerMessageId: null, error: message, blocked: /no existe|archivado/i.test(message) };
      }
    },
    sendMessage: (tenantId, target, message) =>
      outreach.sendMessages(tenantId, target, [
        message.media
          ? { kind: "media", content: message.text, media: { type: message.media.type, url: message.media.url, ...(message.media.fileName ? { fileName: message.media.fileName } : {}) } }
          : { kind: "text", content: message.text }
      ])
  };
}

function numberDirectory(list: Pick<ListConnectionsService, "execute">): NumberDirectory {
  return {
    list: async (tenantId) =>
      (await list.execute(tenantId)).map((connection) => ({
        id: connection.id,
        name: connection.name,
        connected: connection.status === "connected",
        // La API oficial necesita plantillas aprobadas para escribir primero (fase siguiente).
        canBroadcast: connection.method === "qr"
      }))
  };
}

function flowDirectory(catalog: FlowCatalog): FlowDirectory {
  return {
    find: async (tenantId, ids) => new Map((ids.length ? await catalog.findMany(tenantId, ids) : []).map((flow) => [flow.id, { name: flow.name, archived: flow.archived }]))
  };
}
