// ---------------------------------------------------------------------------
// Lo que Ventas necesita de un chat para anotar una venta desde ahí: quién es
// el cliente, por qué número escribió y el anuncio por el que llegó. Así la
// venta cuenta para el ROAS real de ese anuncio y mueve al cliente en el CRM.
//
// Lo resuelve el servidor desde la base (dentro de la cuenta): la web solo
// dice QUÉ chat es, nunca el anuncio (no se puede inventar una atribución).
// Implementación: `infrastructure/persistence/sql/SqlChatSaleLinks.ts`.
// Ventas no conoce el módulo de Conversaciones: solo este puerto.
// ---------------------------------------------------------------------------

export interface ChatSaleLink {
  readonly contactId: string | null;
  readonly connectionId: string | null;
  readonly customerName: string | null;
  /** Solo dígitos, con indicativo. */
  readonly customerPhone: string | null;
  /** El anuncio de Meta por el que llegó el cliente (si llegó por uno). */
  readonly adSourceId: string | null;
}

export interface ChatSaleLinks {
  /** El chat de la cuenta, o `null` si no existe o es de otra cuenta. */
  find(tenantId: string, conversationId: string): Promise<ChatSaleLink | null>;
}
