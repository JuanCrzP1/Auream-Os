import { ChatAdOriginService } from "../../../domains/conversations/application/ChatAdOriginService";
import { SqlChatAdOrigin } from "../../../infrastructure/persistence/sql/SqlChatAdOrigin";
import { composeScheduledMessages, type ScheduledMessages } from "./composeScheduledMessages";
import type { SalesLedger } from "../../../flow-engine/ports/SalesLedger";
import { ContactAvatarService } from "../../../domains/contacts/application/ContactAvatarService";
import { SqlContactAvatarStore } from "../../../infrastructure/persistence/sql/SqlContactAvatarStore";
import type { ApiConfig } from "../config/loadApiConfig";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import type { BuilderWorkspaceRepository } from "../../../domains/automations/builder/application/BuilderWorkspaceRepository";
import type { DocumentTextReader } from "../../../flow-engine/ports/DocumentTextReader";
import type { ContactsServices } from "./composeContactsServices";
import type { IntegrationsServices } from "./composeIntegrationsServices";
import type { ConnectionsServices } from "./composeConnectionsServices";
import { composeNodeRuntime } from "./composeNodeRuntime";
import { SafeHttpRequester } from "../../../infrastructure/http/SafeHttpRequester";
import { SqlRoundRobinCounter } from "../../../infrastructure/persistence/sql/SqlRoundRobinCounter";
import { SqlReceiptRegistry } from "../../../infrastructure/persistence/sql/SqlReceiptRegistry";
import { SqlSessionRepository } from "../../../infrastructure/persistence/sql/SqlSessionRepository";
import { SqlInboundMessageLog } from "../../../infrastructure/persistence/sql/SqlInboundMessageLog";
import { SqlConversationLock } from "../../../infrastructure/persistence/sql/SqlConversationLock";
import { SessionService } from "../../../domains/sessions/application/SessionService";
import { ContextService } from "../../../domains/sessions/application/ContextService";
import { AnalyticsService } from "../../../domains/analytics/application/AnalyticsService";
import { SavedFlowRegistry } from "../../../domains/automations/runtime/SavedFlowRegistry";
import { ExecutionLoop } from "../../../flow-engine/execution/ExecutionLoop";
import { ExecutionOrchestrator } from "../../../flow-engine/execution/ExecutionOrchestrator";
import { ExecutionEventTracker } from "../../../flow-engine/execution/ExecutionEventTracker";
import { EdgeEvaluator } from "../../../flow-engine/edges/EdgeEvaluator";
import { SqlTenantResolver } from "../../../infrastructure/persistence/sql/SqlTenantResolver";
import { HandleInboundMessageService } from "../../../domains/messaging/application/HandleInboundMessageService";
import { ConnectionTriggerRouter, DirectoryInboundContacts, RepositorySessionControl, SessionLiveSessions } from "../../../domains/messaging/application/adapters";
import { StartFlowService } from "../../../domains/messaging/application/StartFlowService";
import type { TurnJournal } from "../../../domains/messaging/application/FlowTurnJournal";
import { StartFlowForContactService } from "../../../domains/messaging/application/StartFlowForContactService";
import { OutreachService } from "../../../domains/messaging/application/OutreachService";
import { FlowTurn } from "../../../domains/messaging/application/FlowTurn";
import type { ContactFieldSync } from "../../../domains/contact-fields/application/ContactFieldSync";
import { contactFieldTurns } from "./contactFieldTurns";
import { FlowTimerService } from "../../../domains/messaging/application/FlowTimerService";
import type { TaskScheduler } from "../../../domains/scheduling/application/TaskScheduler";
import { SchedulerFlowTimers } from "./flowTimerAdapters";
import { ConversationInbox, ConversationRecorder } from "../../../domains/conversations/application/ConversationServices";
import { ChatAttention } from "../../../domains/conversations/application/ChatAttention";
import { NewChatService } from "../../../domains/conversations/application/NewChatService";
import type { DealOwners } from "../../../domains/conversations/application/ports/ConversationPorts";
import type { InboundContacts } from "../../../domains/messaging/application/ports/MessagingPorts";
import { SqlTeamRepository } from "../../../infrastructure/persistence/sql/SqlTeamRepository";
import { SqlConversationRepository } from "../../../infrastructure/persistence/sql/SqlConversationRepository";

// ---------------------------------------------------------------------------
// composeMessagingServices — los mensajes reales de WhatsApp de punta a punta:
// el motor de PRODUCCIÓN (sesiones y flujos guardados en PostgreSQL, contactos,
// turnos y comprobantes reales, IA/píxel/integraciones de la cuenta) y la
// mensajería entrante que lo usa.
//
// Distinto de la simulación del builder, que corre todo en memoria y aislado.
// ---------------------------------------------------------------------------

export interface MessagingServices {
  /** Mensajes entrantes (`HandleInboundMessageService`, más la revisión de despertadores vencidos). */
  readonly inbound: Pick<HandleInboundMessageService, "execute">;
  /** La bandeja de Conversaciones (lista y filtros, hilo, responder, pausar el bot, etiquetar, enviar flujos). */
  readonly conversations: ConversationInbox;
  /** La atención de cada chat: tomar, pasar, resolver y quién puede atender. */
  readonly attention: ChatAttention;
  /** «Chat nuevo»: escribirle primero a un número. */
  readonly newChats: NewChatService;
  /** Despertadores vencidos de los flujos (los ejecuta la cola de tareas). */
  readonly timers: FlowTimerService;
  /** Recibos de entregado/leído de lo que salió por un número (avisos del proveedor). */
  readonly receipts: Pick<ConversationRecorder, "applyReceipts">;
  /** Iniciar un flujo para un teléfono aunque nunca haya escrito (webhooks de entrada). */
  readonly flows: StartFlowForContactService;
  /** Fotos de perfil de los contactos (se renuevan cuando escriben). */
  readonly avatars: Pick<ContactAvatarService, "refreshIfStale">;
  /** Escribirle primero a un cliente (Difusiones): un flujo o mensajes, y quedan en su chat. */
  readonly outreach: OutreachService;
  /** De qué anuncio llegó el cliente de un chat. */
  readonly adOrigin: ChatAdOriginService;
  /** Mensajes programados de los chats (y su manejador en la cola). */
  readonly scheduled: ScheduledMessages;
}

/** Oye cada mensaje entrante ya guardado (p. ej. Difusiones: «SALIR»). Nunca debe lanzar. */
export interface InboundListener {
  heard(tenantId: string, message: { readonly phone: string; readonly text: string | null }): Promise<void>;
}

export interface MessagingDependencies {
  readonly config: ApiConfig;
  readonly sql: SqlClient;
  /** Pool aparte para los candados por conversación (nunca compite con el trabajo). */
  readonly lockSql: SqlClient;
  readonly workspaces: BuilderWorkspaceRepository;
  readonly contacts: ContactsServices;
  readonly integrations: IntegrationsServices;
  readonly connections: ConnectionsServices;
  readonly documents: DocumentTextReader;
  /** Cola de tareas: los despertadores de los flujos (Programador, tiempos de espera, pausas largas). */
  readonly scheduler: TaskScheduler;
  /** Historial interno de los turnos (Neon + registro). Ausente: no se anota. */
  readonly journal?: TurnJournal;
  /** Campos del cliente: lo que guardan los bloques y es un campo pasa al cliente. Ausente: queda solo en la conversación. */
  readonly contactFields?: Pick<ContactFieldSync, "persist">;
  /** Ventas del bloque Registrar venta (se guardan en Ventas). */
  readonly sales: SalesLedger;
  /** Quién oye los mensajes entrantes (se conecta después: Difusiones depende de Mensajería). */
  readonly inboundListeners?: { readonly current: ReadonlyArray<InboundListener> };
  /** CRM: el responsable del chat es el mismo del embudo. */
  readonly dealOwners: DealOwners;
  /**
   * CRM: un cliente que ya existía escribió (los nuevos entran al crearse).
   * Corre antes del flujo para no pisar la etapa que el flujo ponga. Nunca lanza.
   */
  readonly onContactWrote?: (tenantId: string, contactId: string) => Promise<void>;
}

export function composeMessagingServices(deps: MessagingDependencies): MessagingServices {
  const http = new SafeHttpRequester({ allowPrivateNetworks: deps.config.integrationsAllowPrivateNetwork });
  const sessionRepository = new SqlSessionRepository(deps.sql);
  const sessions = new SessionService(sessionRepository);

  const nodeRuntime = composeNodeRuntime({
    roundRobin: new SqlRoundRobinCounter(deps.sql),
    contacts: deps.contacts.directory,
    http,
    ai: deps.integrations.aiGateway,
    conversions: deps.integrations.conversionTracker,
    media: http,
    documents: deps.documents,
    receipts: new SqlReceiptRegistry(deps.sql),
    sales: deps.sales
  });

  // La zona horaria de cada empresa (la de Empresa; si no eligió una, la de la plataforma).
  const tenants = new SqlTenantResolver(deps.sql, deps.config.defaultTimezone);
  const engine = new ExecutionOrchestrator(
    tenants,
    new SavedFlowRegistry(deps.workspaces),
    sessions,
    new ExecutionLoop(sessions, new ContextService(), nodeRuntime, new EdgeEvaluator(), new ExecutionEventTracker(new AnalyticsService()))
  );

  const lock = new SqlConversationLock(deps.lockSql);
  const conversations = new SqlConversationRepository(deps.sql);
  const recorder = new ConversationRecorder(conversations);
  const delivery = deps.connections.channel;
  // Un solo «turno de flujo» para los tres orígenes: mensaje, envío a mano y despertador.
  const turn = new FlowTurn(engine, delivery, recorder, new SchedulerFlowTimers(deps.scheduler), undefined, deps.journal, deps.contactFields ? contactFieldTurns(deps.contactFields, deps.contacts.directory) : undefined);
  const launcher = new StartFlowService(deps.connections.flows, lock, new RepositorySessionControl(sessionRepository), turn);

  const inbound = new HandleInboundMessageService(
      new SqlInboundMessageLog(deps.sql),
      lock,
      inboundContacts(new DirectoryInboundContacts(deps.contacts.directory), deps.onContactWrote),
      new SessionLiveSessions(sessionRepository, deps.connections.flows),
      new ConnectionTriggerRouter(deps.connections.triggers),
      turn,
      recorder
    );

  const inbox = new ConversationInbox(conversations, recorder, delivery, launcher, {
    // Etiquetar el chat = etiquetar a su cliente en Contactos (valida que las etiquetas sean de la cuenta).
    setLabels: async (tenantId, contactId, labelIds) => {
      await deps.contacts.setContactLabels.execute(tenantId, contactId, labelIds);
    }
  });

  return {
    // Cada mensaje entrante revisa, de paso, si quedaron despertadores vencidos.
    inbound: {
      execute: async (tenantId, message) => {
        const result = await inbound.execute(tenantId, message);
        if (result.outcome !== "duplicate") {
          for (const listener of deps.inboundListeners?.current ?? []) await listener.heard(tenantId, { phone: message.phone, text: message.text }).catch(() => undefined);
        }
        await deps.scheduler.nudgeIfDue();
        return result;
      }
    },
    timers: new FlowTimerService(lock, recorder, turn),
    adOrigin: new ChatAdOriginService(new SqlChatAdOrigin(deps.sql)),
    scheduled: composeScheduledMessages({ sql: deps.sql, scheduler: deps.scheduler, chats: conversations, sender: delivery, recorder, tenants }),
    flows: new StartFlowForContactService(recorder, launcher),
    avatars: new ContactAvatarService(new SqlContactAvatarStore(deps.sql)),
    outreach: new OutreachService(recorder, delivery, launcher),
    receipts: recorder,
    conversations: inbox,
    attention: new ChatAttention(conversations, chatTeam(new SqlTeamRepository(deps.sql)), deps.dealOwners),
    newChats: new NewChatService(
      {
        isConnected: async (tenantId, connectionId) =>
          (await deps.connections.list.execute(tenantId)).some((connection) => connection.id === connectionId && connection.status === "connected")
      },
      {
        identify: async (tenantId, phone, name) => {
          const { profile } = await deps.contacts.directory.identify(tenantId, { channel: "whatsapp", externalKey: phone }, name);
          return { contactId: profile.id };
        }
      },
      recorder,
      inbox
    )
  };
}

/** Quién puede atender chats: el equipo, menos los de solo lectura (igual que el responsable del CRM). */
function chatTeam(team: SqlTeamRepository) {
  return {
    agents: async (tenantId: string) =>
      (await team.listMembers(tenantId))
        .filter((member) => member.role !== "viewer" && member.role !== "api_client" && member.role !== "worker")
        .map((member) => ({ userId: member.userId, name: member.displayName ?? member.email ?? "Sin nombre", photoUrl: member.photoUrl }))
  };
}

/** Identifica al cliente de cada mensaje y, si ya existía, avisa al CRM que escribió. */
function inboundContacts(directory: InboundContacts, onWrote?: (tenantId: string, contactId: string) => Promise<void>): InboundContacts {
  if (!onWrote) return directory;
  return {
    identify: async (tenantId, phone, displayName, ad) => {
      const contact = await directory.identify(tenantId, phone, displayName, ad);
      if (!contact.isNew) await onWrote(tenantId, contact.contactId);
      return contact;
    }
  };
}
