import type { ConversationFacts } from "../../../contracts/ConversationFacts";
import type { ConversationFactsReader } from "../../../flow-engine/ports/ConversationFactsReader";
import type { SqlExecutor } from "./SqlClient";
import { isUuid } from "./sqlValues";

// ---------------------------------------------------------------------------
// Quién atiende la conversación y por qué número: una consulta por turno, y
// solo si el flujo usa esas variables (lo decide el motor). La conversación
// se reconoce por su clave «<conexión>:<teléfono>».
// ---------------------------------------------------------------------------

export class SqlConversationFacts implements ConversationFactsReader {
  public constructor(private readonly sql: SqlExecutor) {}

  public async facts(tenantId: string, conversationKey: string): Promise<ConversationFacts | null> {
    const at = conversationKey.indexOf(":");
    const [connectionId, phone] = at > 0 ? [conversationKey.slice(0, at), conversationKey.slice(at + 1)] : ["", ""];
    if (!isUuid(tenantId) || !isUuid(connectionId)) return null;
    const { rows } = await this.sql.query<{ connection_name: string | null; phone_number: string | null; assignee_name: string | null }>(
      `select c.name as connection_name, c.phone_number, coalesce(u.display_name, u.email) as assignee_name
         from whatsapp_connections c
         left join conversations v on v.tenant_id = c.tenant_id and v.connection_id = c.id and v.phone = $3
         left join user_profiles u on u.user_id = v.assignee_id
        where c.tenant_id = $1 and c.id = $2`,
      [tenantId, connectionId, phone]
    );
    const row = rows[0];
    return row ? { assigneeName: row.assignee_name, connectionName: row.connection_name, connectionNumber: row.phone_number } : null;
  }
}
