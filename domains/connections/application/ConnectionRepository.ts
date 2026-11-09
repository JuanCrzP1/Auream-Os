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
   * Elimina el número de la cuenta: deja de aparecer en todas las lecturas y
   * pierde su credencial y sus disparadores, pero NO se borra el historial de
   * sus chats (la bandeja lo sigue mostrando como «número eliminado»).
   * `true` si existía.
   */
  delete(tenantId: string, id: string): Promise<boolean>;
}
