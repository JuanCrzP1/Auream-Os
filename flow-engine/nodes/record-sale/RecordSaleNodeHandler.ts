import type { FlowNode } from "../../../contracts/FlowSnapshot";
import { RECORD_SALE_STATE_VALUES, readRecordSaleConfig } from "../../../contracts/RecordSaleConfig";
import type { NodeExecutionResult, RuntimeInput, Session } from "../../../contracts/RuntimeContracts";
import { renderTemplate } from "../../../contracts/TemplateVariables";
import { identityOf, type ContactDirectory } from "../../ports/ContactDirectory";
import type { SalesLedger } from "../../ports/SalesLedger";
import { templateResolver } from "../../templates/templateResolver";
import type { NodeHandler } from "../NodeHandler";

// ---------------------------------------------------------------------------
// RecordSaleNodeHandler — el bloque «Registrar venta».
//
// Resuelve las variables del bloque ({comprobante.valor}…) y le pide a Ventas
// (puerto `SalesLedger`) que guarde la venta. Ventas decide si cuenta o queda
// «Por revisar». Guardar la venta no puede interrumpir la conversación: si
// falla, el flujo SIGUE por su única salida y el motivo queda en el resultado.
//
// Deja `{venta.id}`, `{venta.estado}` (aprobada · por_revisar · error),
// `{venta.producto}`, `{venta.valor}`, `{venta.moneda}` y `{venta.pais}` para
// el Pixel (Compra), una Notificación o un Condicional.
// ---------------------------------------------------------------------------

export class RecordSaleNodeHandler implements NodeHandler {
  public constructor(
    private readonly ledger: SalesLedger,
    private readonly contacts: ContactDirectory
  ) {}

  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "record-sale";
  }

  public async execute(node: FlowNode, input: RuntimeInput, session: Session): Promise<NodeExecutionResult> {
    const startedAt = Date.now();
    const config = readRecordSaleConfig(node.config);
    const contact = await this.contacts.resolve(session.tenantId, identityOf(input.envelope));
    const resolve = templateResolver({ ...input, sessionContext: { ...input.sessionContext, ...session.context } }, contact);
    const missing = new Set<string>();
    const render = (template: string): string => {
      const rendered = renderTemplate(template, resolve);
      rendered.missing.forEach((name) => missing.add(name));
      return rendered.text.trim();
    };
    const usesVariables = config.amountMode === "variable";

    const result = await this.ledger.record(session.tenantId, {
      productId: config.productId,
      amountMode: config.amountMode,
      amount: usesVariables ? render(config.amount) : "",
      currency: usesVariables ? render(config.currency) : "",
      customerName: render(config.customerName),
      reference: render(config.reference),
      contactId: contact.id,
      contactName: contact.name,
      customerPhone: contact.phone ?? input.envelope.userKey,
      // La conversación es «conexión:teléfono» (HandleInboundMessageService).
      connectionId: input.envelope.conversationKey.includes(":") ? input.envelope.conversationKey.split(":")[0]! : null,
      flowKey: input.envelope.flowKey,
      adSourceId: contact.ad?.sourceId ?? null,
      soldAt: input.now,
      stepKey: `${session.id}:${node.id}:${input.envelope.messageId}`
    });

    const prefix = config.resultVariable;
    const missingEvents = [...missing].map((name) => `record_sale_variable_missing:${node.id}:${name}`);
    const durationMs = Date.now() - startedAt;

    if (!result.ok) {
      return {
        executionStatus: "success",
        outputMessages: [],
        contextPatch: { [`${prefix}.estado`]: "error" },
        nodeResult: { reason: result.reason, message: result.message, durationMs },
        domainEvents: [`sale_failed:${node.id}:${result.reason}`, ...missingEvents]
      };
    }

    const sale = result.sale;
    return {
      executionStatus: "success",
      outputMessages: [],
      contextPatch: {
        [`${prefix}.id`]: sale.id ?? "",
        [`${prefix}.estado`]: RECORD_SALE_STATE_VALUES[sale.status],
        [`${prefix}.producto`]: sale.productName ?? "",
        [`${prefix}.valor`]: sale.amount === null ? "" : String(sale.amount),
        [`${prefix}.moneda`]: sale.currency ?? "",
        [`${prefix}.pais`]: sale.country ?? ""
      },
      nodeResult: {
        status: sale.status,
        productName: sale.productName,
        amount: sale.amount,
        currency: sale.currency,
        country: sale.country,
        ...(sale.reviewReason ? { reviewReason: sale.reviewReason } : {}),
        duplicate: sale.duplicate,
        saved: sale.saved,
        durationMs
      },
      domainEvents: [`${sale.status === "approved" ? "sale_recorded" : "sale_review"}:${node.id}${sale.duplicate ? ":duplicate" : ""}`, ...missingEvents]
    };
  }
}
