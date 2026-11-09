import type { McpCredential } from "../domain/McpCredential";

/** Persistencia de las credenciales MCP. Todo por cuenta, salvo buscar por huella (al conectarse un agente). */
export interface McpCredentialRepository {
  list(tenantId: string): Promise<McpCredential[]>;
  findByHash(tokenHash: string): Promise<McpCredential | null>;
  create(credential: McpCredential): Promise<void>;
  remove(tenantId: string, id: string): Promise<boolean>;
  /** Anota el último uso. */
  touch(id: string, at: string): Promise<void>;
}
