import type { MessageStatus } from "@contracts/ConversationContracts";
import { DeliveredGlyph, SentGlyph } from "./ChatGlyphs";

// Los chulos de WhatsApp de lo que sale, según los avisos del proveedor:
// uno gris (enviado), dos grises (entregado), dos azules (leído).

const TICKS = {
  sent: { label: "Enviado", Glyph: SentGlyph },
  delivered: { label: "Entregado", Glyph: DeliveredGlyph },
  read: { label: "Leído", Glyph: DeliveredGlyph }
} as const;

export function DeliveryTicks({ status }: { readonly status: MessageStatus }) {
  if (status !== "sent" && status !== "delivered" && status !== "read") return null;
  const { label, Glyph } = TICKS[status];
  return (
    <span className={`ios-ticks ios-ticks--${status}`} role="img" aria-label={label} title={label}>
      <Glyph />
    </span>
  );
}
