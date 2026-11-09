import type { ClaimOutcome, ReceiptClaim, ReceiptRegistry } from "../../../flow-engine/ports/ReceiptRegistry";

/** Comprobantes aceptados en memoria (simulación y tests). */
export class InMemoryReceiptRegistry implements ReceiptRegistry {
  private readonly claimed = new Map<string, ReceiptClaim>();

  public async exists(tenantId: string, fingerprint: string): Promise<boolean> {
    return this.claimed.has(`${tenantId}:${fingerprint}`);
  }

  public async claim(tenantId: string, receipt: ReceiptClaim): Promise<ClaimOutcome> {
    const key = `${tenantId}:${receipt.fingerprint}`;
    if (this.claimed.has(key)) return "duplicate";
    this.claimed.set(key, receipt);
    return "new";
  }
}
