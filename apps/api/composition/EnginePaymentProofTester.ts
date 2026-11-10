import { readPaymentProofConfig } from "../../../contracts/PaymentProofConfig";
import type { PaymentProofTestResult } from "../../../contracts/PaymentProofTestContracts";
import { sampleResolver } from "../../../contracts/TemplateVariables";
import type { PaymentProofTester } from "../../../domains/automations/builder/application/ports/PaymentProofTester";
import type { DocumentTextReader } from "../../../flow-engine/ports/DocumentTextReader";
import type { ReceiptRegistry } from "../../../flow-engine/ports/ReceiptRegistry";
import { runPaymentProofStep } from "../../../flow-engine/nodes/payment-proof/runPaymentProofStep";
import { DisabledHttpRequester } from "../../../infrastructure/http/DisabledHttpRequester";

/**
 * «Probar» recorre EXACTAMENTE el mismo código que el bloque
 * (`runPaymentProofStep`) con el archivo subido. Sin `claim`: la prueba no
 * gasta el comprobante, solo consulta si la cuenta ya lo había aceptado.
 */
export class EnginePaymentProofTester implements PaymentProofTester {
  public constructor(
    private readonly reader: DocumentTextReader,
    private readonly receipts: ReceiptRegistry,
    /** Zona horaria de la empresa (fechas del comprobante). */
    private readonly timezoneOf: (tenantId: string) => Promise<string>
  ) {}

  public async test(
    tenantId: string,
    config: Readonly<Record<string, unknown>>,
    document: { readonly bytes: Uint8Array; readonly contentType: string },
    variables: Readonly<Record<string, string>>
  ): Promise<PaymentProofTestResult> {
    const step = await runPaymentProofStep(
      readPaymentProofConfig(config),
      { tenantId, resolve: sampleResolver(variables), now: new Date(), timezone: await this.timezoneOf(tenantId), document },
      // El archivo ya viene en la petición: no se descarga nada.
      { fetcher: new DisabledHttpRequester(), reader: this.reader, receipts: this.receipts }
    );
    return {
      output: step.output,
      message: step.message,
      checks: step.checks,
      fields: step.fields,
      ...(step.text ? { text: step.text.slice(0, 4000) } : {}),
      ...(step.method ? { method: step.method } : {}),
      durationMs: step.durationMs,
      missingVariables: step.missingVariables
    };
  }
}
