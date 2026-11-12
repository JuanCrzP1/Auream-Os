import type { ConversationSummary } from "@contracts/ConversationContracts";
import type { ProductSummary, SaleSummary } from "@contracts/SalesContracts";
import { formatMoney } from "@shared/format/formatMoney";
import { RecordSaleDialog } from "@shared/sales/RecordSaleDialog";
import { recordSale } from "@shared/sales/recordSaleApi";
import { SendFlowDialog } from "../SendFlowDialog";

/** Qué diálogo del chat está abierto. */
export type ChatDialog = "flow" | "sale" | null;

/** Lo que dice el chat al registrar una venta: aprobada (y cuánto) o por revisar (y por qué). */
export function saleNotice(sale: SaleSummary): string {
  if (sale.status !== "approved") return `Venta registrada: quedó «Por revisar» (${(sale.reviewReason ?? "falta un dato").replace(/\.$/, "").toLowerCase()}). Complétala en Ventas.`;
  const what = [sale.productName, sale.amount !== null && sale.currency ? formatMoney(sale.amount, sale.currency) : null].filter(Boolean).join(" · ");
  return `Venta registrada${what ? `: ${what}` : ""}.${sale.adSourceId ? " Cuenta para el anuncio por el que llegó." : ""}`;
}

/**
 * Los diálogos de un chat: ejecutar un flujo y registrar una venta (con el
 * cliente, el número y el anuncio del chat). Cada uno avisa en el chat cómo
 * salió (`onNotice`).
 */
export function ChatDialogs({ dialog, conversation, name, products, onLaunchFlow, onNotice, onClose }: {
  readonly dialog: ChatDialog;
  readonly conversation: ConversationSummary;
  readonly name: string;
  readonly products: ReadonlyArray<ProductSummary>;
  readonly onLaunchFlow: (automationId: string) => Promise<{ readonly flowName: string; readonly sent: number; readonly failed: number }>;
  readonly onNotice: (text: string) => void;
  readonly onClose: () => void;
}) {
  if (dialog === "flow") {
    return (
      <SendFlowDialog
        contactName={name}
        onClose={onClose}
        onSend={async (automationId) => {
          const result = await onLaunchFlow(automationId);
          onNotice(result.failed ? `Se ejecutó «${result.flowName}», pero ${result.failed} mensaje(s) no salieron.` : `Se ejecutó «${result.flowName}».`);
          return result;
        }}
      />
    );
  }
  if (dialog === "sale") {
    return (
      <RecordSaleDialog
        products={products}
        chat={{ conversationId: conversation.id, customerName: conversation.contactName, phone: conversation.phone, connectionName: conversation.connectionName }}
        onClose={onClose}
        onRecord={async (request) => {
          const sale = await recordSale(request);
          onNotice(saleNotice(sale));
          return sale;
        }}
      />
    );
  }
  return null;
}
