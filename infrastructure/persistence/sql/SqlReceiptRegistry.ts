import type { ClaimOutcome, ReceiptClaim, ReceiptRegistry } from "../../../flow-engine/ports/ReceiptRegistry";
import type { SqlExecutor } from "./SqlClient";
import { isUuid } from "./sqlValues";

/**
 * Comprobantes aceptados en PostgreSQL (`010_payment_proof_receipts.sql`).
 * `claim` es un solo `insert … on conflict do nothing`: atómico sin bloqueos.
 */
export class SqlReceiptRegistry implements ReceiptRegistry {
  public constructor(private readonly sql: SqlExecutor) {}

  public async exists(tenantId: string, fingerprint: string): Promise<boolean> {
    if (!isUuid(tenantId)) return false;
    const result = await this.sql.query(`select 1 from payment_proof_receipts where tenant_id = $1 and fingerprint = $2`, [tenantId, fingerprint]);
    return result.rows.length > 0;
  }

  public async claim(tenantId: string, receipt: ReceiptClaim): Promise<ClaimOutcome> {
    if (!isUuid(tenantId)) return "new";
    const result = await this.sql.query(
      `insert into payment_proof_receipts (tenant_id, fingerprint, reference, amount, currency, conversation_key, flow_key)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (tenant_id, fingerprint) do nothing
       returning 1`,
      [
        tenantId,
        receipt.fingerprint,
        receipt.reference?.slice(0, 80) ?? null,
        receipt.amount ?? null,
        receipt.currency ?? null,
        receipt.conversationKey.slice(0, 200),
        receipt.flowKey.slice(0, 200)
      ]
    );
    return result.rows.length > 0 ? "new" : "duplicate";
  }
}
