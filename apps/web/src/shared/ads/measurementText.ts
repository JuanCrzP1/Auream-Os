import type { AdMeasurement } from "@contracts/AdMeasurementContracts";
import { formatCount } from "./adsFormat";

// ---------------------------------------------------------------------------
// Qué decirle a la persona cuando Auream no ve lo que venden sus anuncios:
// qué pasa, por qué no hay ROAS real ni consejos, y qué hacer. Función pura
// (sin React): la usan Meta Ads › Rendimiento y el Dashboard, con el mismo
// texto en los tres sitios.
// ---------------------------------------------------------------------------

export interface MeasurementCopy {
  readonly title: string;
  readonly body: string;
  readonly action?: { readonly label: string; readonly to: string };
}

/** Desde cuántas compras de Meta se nombra la diferencia (como en el consejo de cada fila). */
const META_SALES_WORTH_NAMING = 3;

export function measurementCopy(seen: AdMeasurement): MeasurementCopy | null {
  if (seen.state === "none") {
    return {
      title: "Auream aún no ve los chats de tus anuncios",
      body: `Meta cobró ${formatCount(seen.metaChats)} chats en este periodo y a Auream no llegó ninguno. Mientras tanto ves lo que reporta Meta, marcado con «Meta»; la ganancia y el ROAS real se calculan cuando vendas en Auream. Conecta el WhatsApp al que llevan esos anuncios y Auream empieza a medir tus ventas de verdad.`,
      action: { label: "Conectar un número", to: "/connections" }
    };
  }
  if (seen.state === "partial") {
    const percent = Math.round((seen.arrivedChats / seen.metaChats) * 100);
    const share = seen.arrivedChats > 0 && percent === 0 ? "menos del 1 %" : `${percent} %`;
    return {
      title: "Medición parcial",
      body: `A Auream llegaron ${formatCount(seen.arrivedChats)} de los ${formatCount(seen.metaChats)} chats que cobró Meta (${share}). El ROAS real solo cuenta esa parte, así que aún no se juzgan las campañas a las que les falta. Pasa cuando conectaste hace poco o cuando algunos anuncios llevan a otro número.`
    };
  }
  if (seen.state === "unsold") {
    const meta = seen.metaPurchases >= META_SALES_WORTH_NAMING ? ` y Meta cuenta ${formatCount(seen.metaPurchases)}` : "";
    return {
      title: "Auream no ve ventas de tus anuncios",
      body: `Los chats sí llegan, pero no hay ventas anotadas de esos clientes${meta}. Sin ventas no se puede decir qué campaña rinde: anótalas con el bloque «Registrar venta» en tus flujos o desde el chat.`
    };
  }
  return null;
}

/** En una línea, para donde no cabe el aviso (la franja del ROAS). */
export function measurementSentence(seen: AdMeasurement): string | null {
  if (seen.state === "none") return "Auream aún no ve los chats de tus anuncios: no hay con qué calcularlo.";
  if (seen.state === "unsold") return "Auream no ve ventas de tus anuncios: no hay con qué calcularlo.";
  if (seen.state === "partial") return `Medición parcial: a Auream llegaron ${formatCount(seen.arrivedChats)} de ${formatCount(seen.metaChats)} chats de tus anuncios.`;
  return null;
}
