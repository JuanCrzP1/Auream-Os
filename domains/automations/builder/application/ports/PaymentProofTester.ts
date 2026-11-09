import type { PaymentProofTestResult } from "../../../../../contracts/PaymentProofTestContracts";

/** Revisa una vez un comprobante de ejemplo con un bloque (lo conecta la composición con el motor). */
export interface PaymentProofTester {
  test(
    tenantId: string,
    config: Readonly<Record<string, unknown>>,
    document: { readonly bytes: Uint8Array; readonly contentType: string },
    variables: Readonly<Record<string, string>>
  ): Promise<PaymentProofTestResult>;
}
