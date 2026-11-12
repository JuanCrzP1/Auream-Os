import type { OutboundMessage } from "../../../../contracts/RuntimeContracts";

// Lo que la bandeja necesita de otros módulos; la composición decide quién lo cumple.

export interface SendResult {
  readonly message: OutboundMessage;
  readonly ok: boolean;
  readonly error?: string;
  /** Id que WhatsApp le dio (para los avisos de entregado y leído). */
  readonly providerMessageId?: string;
}

/** Envía por el número del chat (Conexiones). */
export interface ConversationSender {
  deliver(tenantId: string, connectionId: string, phone: string, messages: ReadonlyArray<OutboundMessage>): Promise<{ readonly results: ReadonlyArray<SendResult> }>;
}

/** Inicia un flujo en el chat (Mensajería: corta el recorrido actual y empieza ese). */
export interface FlowLauncher {
  launch(tenantId: string, conversation: { readonly id: string; readonly connectionId: string; readonly phone: string }, automationId: string): Promise<{ readonly flowName: string; readonly sent: number; readonly failed: number }>;
}

/** Pone las etiquetas del cliente del chat (Contactos: mismo catálogo que usan los flujos). */
export interface ContactLabeler {
  setLabels(tenantId: string, contactId: string, labelIds: ReadonlyArray<string>): Promise<void>;
}

/** Equipo: quién puede atender chats (no es de solo lectura). */
export interface ChatTeam {
  agents(tenantId: string): Promise<ReadonlyArray<{ readonly userId: string; readonly name: string; readonly photoUrl: string | null }>>;
}

/**
 * CRM: el responsable del chat es el mismo del cliente en el embudo. Al tomar
 * o pasar un chat, sus negocios SIN responsable quedan con esa persona (no
 * le quita un cliente a quien ya lo tenía).
 */
export interface DealOwners {
  claimUnowned(tenantId: string, contactId: string, ownerId: string, actorId: string): Promise<void>;
}

/** Contactos: el cliente de ese teléfono (lo crea si no existe). */
export interface ChatContacts {
  identify(tenantId: string, phone: string, name: string | null): Promise<{ readonly contactId: string }>;
}

/** Conexiones: si un número de la cuenta está conectado (para escribir desde él). */
export interface ChatNumbers {
  isConnected(tenantId: string, connectionId: string): Promise<boolean>;
}
