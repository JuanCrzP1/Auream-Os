import type { WhatsAppConnection } from "../domain/WhatsAppConnection";

export interface ConnectionRepository {
  listByTenant(tenantId: string): Promise<WhatsAppConnection[]>;
  findById(tenantId: string, id: string): Promise<WhatsAppConnection | null>;
  /**
   * Para los avisos del proveedor (sin sesión de usuario): busca por id en
   * cualquier cuenta. Quien la usa DEBE verificar la credencial del aviso.
   */
  findForProvider(id: string): Promise<WhatsAppConnection | null>;
  /** Inserta o actualiza. Un nombre repetido en la cuenta → `ConflictError`. */
  save(connection: WhatsAppConnection): Promise<void>;
  /**
   * Guarda SOLO si la conexión sigue con la sesión `expectedRef` del proveedor
   * (`null` = sin sesión). `false` si otro pedido ya guardó otra: dos QR
   * pedidos a la vez no dejan dos sesiones.
   */
  saveIfSession(connection: WhatsAppConnection, expectedRef: string | null): Promise<boolean>;
  /**
   * Elimina el número de la cuenta: deja de aparecer en todas las lecturas y
   * pierde su credencial y sus disparadores, pero NO se borra el historial de
   * sus chats (la bandeja lo sigue mostrando como «número eliminado»).
   * `true` si existía.
   */
  delete(tenantId: string, id: string): Promise<boolean>;
}
