import type { InboundChannelMessage, InboundOutcome } from "../../../contracts/InboundMessageContracts";
import type { InboundMessageLog } from "../../../domains/messaging/application/ports/MessagingPorts";
import type { SqlExecutor } from "./SqlClient";

/** Registro de mensajes entrantes (`015_inbound_messages.sql`): reclamo atómico y resultado. */
export class SqlInboundMessageLog implements InboundMessageLog {
  public constructor(private readonly sql: SqlExecutor) {}

  public async claim(tenantId: string, message: InboundChannelMessage): Promise<boolean> {
    const result = await this.sql.query(
      `insert into inbound_messages (tenant_id, connection_id, provider_message_id, phone, kind, provider_type, text_preview)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (connection_id, provider_message_id) do nothing
       returning id`,
      [tenantId, message.connectionId, message.providerMessageId.slice(0, 200), message.phone, message.kind, message.providerType.slice(0, 80), message.text.slice(0, 120)]
    );
    return result.rows.length > 0;
  }

  public async finish(
    tenantId: string,
    connectionId: string,
    providerMessageId: string,
    outcome: InboundOutcome,
    detail: { readonly flowKey?: string; readonly sent?: number; readonly error?: string; readonly events?: ReadonlyArray<string> }
  ): Promise<void> {
    await this.sql.query(
      `update inbound_messages set outcome = $4, flow_key = $5, sent_count = $6, error = $7, events = $8, processed_at = now()
       where tenant_id = $1 and connection_id = $2 and provider_message_id = $3`,
      [tenantId, connectionId, providerMessageId.slice(0, 200), outcome, detail.flowKey ?? null, detail.sent ?? null, detail.error?.slice(0, 500) ?? null, (detail.events ?? []).slice(0, 40)]
    );
  }
}
