import type { McpCredential } from "../domain/McpCredential";

/** Persistencia de las credenciales MCP. Todo por cuenta, salvo buscar por huella (al conectarse un agente). */
export interface McpCredentialRepository {
  list(tenantId: string): Promise<McpCredential[]>;
  /** Por la huella de su token fijo (credenciales `token`). */
  findByHash(tokenHash: string): Promise<McpCredential | null>;
  /** Por la huella de un token de acceso OAuth que no ha vencido a la fecha `now` (ISO). */
  findByAccessHash(accessHash: string, now: string): Promise<McpCredential | null>;
  create(credential: McpCredential): Promise<void>;
  remove(tenantId: string, id: string): Promise<boolean>;
  /** Quita las credenciales que autorizó antes el mismo agente (al volver a autorizarlo). */
  removeByClient(tenantId: string, clientId: string): Promise<void>;
  /** Anota el último uso. */
  touch(id: string, at: string): Promise<void>;
}
