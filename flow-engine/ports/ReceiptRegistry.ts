// ---------------------------------------------------------------------------
// ReceiptRegistry — comprobantes ya aceptados por la cuenta, para rechazar
// los repetidos («Comprobante repetido»).
//
// Cada comprobante se identifica por su huella (`fingerprint`): la referencia
// del pago si el comprobante la trae; si no, un resumen de sus datos.
//
// `claim` es atómico: dos mensajes con el mismo comprobante a la vez → solo
// uno lo reclama. En producción vive en PostgreSQL (`payment_proof_receipts`).
// ---------------------------------------------------------------------------

export interface ReceiptClaim {
  readonly fingerprint: string;
  /** Referencia leída (si la hay), para mostrarla en el historial. */
  readonly reference?: string;
  readonly amount?: number;
  readonly currency?: string;
  /** Contacto o conversación que lo envió. */
  readonly conversationKey: string;
  readonly flowKey: string;
}

export type ClaimOutcome = "new" | "duplicate";

export interface ReceiptRegistry {
  /** ¿Ya se aceptó antes? No registra nada (para «Probar»). */
  exists(tenantId: string, fingerprint: string): Promise<boolean>;
  /** Lo registra si es nuevo; si ya existía, `duplicate`. */
  claim(tenantId: string, receipt: ReceiptClaim): Promise<ClaimOutcome>;
}
