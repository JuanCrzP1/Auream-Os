import type { OutboundMessage } from "../../../../contracts/RuntimeContracts";

// Lo que la bandeja necesita de otros módulos; la composición decide quién lo cumple.

export interface SendResult {
  readonly message: OutboundMessage;
  readonly ok: boolean;
  readonly error?: string;
}

/** Envía por el número del chat (Conexiones). */
export interface ConversationSender {
  deliver(tenantId: string, connectionId: string, phone: string, messages: ReadonlyArray<OutboundMessage>): Promise<{ readonly results: ReadonlyArray<SendResult> }>;
}

/** Inicia un flujo en el chat (Mensajería: corta el recorrido actual y empieza ese). */
export interface FlowLauncher {
  launch(tenantId: string, conversation: { readonly id: string; readonly connectionId: string; readonly phone: string }, automationId: string): Promise<{ readonly flowName: string; readonly sent: number; readonly failed: number }>;
}
