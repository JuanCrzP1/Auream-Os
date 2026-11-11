import type { AbTestSettings } from "../../../contracts/BroadcastContracts";
import type { Random } from "./Pace";

// ---------------------------------------------------------------------------
// Versiones de una difusión.
//   · Sin prueba A/B: cada persona recibe una versión al azar. Así no salen
//     cientos de mensajes idénticos, que es lo que WhatsApp ve como spam.
//   · Con prueba A/B: una parte de la lista (`sharePercent`) se reparte entre
//     las versiones; el resto espera (`null`) y recibe la que más VENDIÓ.
// ---------------------------------------------------------------------------

/** Baraja (Fisher–Yates): quién entra a la prueba no depende del orden de la lista. */
export function shuffle<T>(items: ReadonlyArray<T>, random: Random = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** La versión de cada persona, en el orden de la lista ya barajada; `null` = espera al ganador. */
export function assignVariants(count: number, variants: number, abTest: AbTestSettings | null, random: Random = Math.random): Array<number | null> {
  if (variants <= 1) return Array.from({ length: count }, () => 0);
  if (!abTest) return Array.from({ length: count }, () => Math.min(variants - 1, Math.floor(random() * variants)));
  // Al menos 1 por versión para que haya con qué comparar.
  const testers = Math.min(count, Math.max(variants, Math.round((count * abTest.sharePercent) / 100)));
  return Array.from({ length: count }, (_, index) => (index < testers ? index % variants : null));
}

export interface VariantScore {
  readonly variant: number;
  readonly sent: number;
  readonly bought: number;
  /** En la moneda principal de la difusión. */
  readonly revenue: number;
  readonly replied: number;
}

/**
 * La que más vendió (por cada envío, para que una versión con más envíos no
 * gane por tamaño); empate: más plata, después más respuestas, después la primera.
 */
export function pickWinner(scores: ReadonlyArray<VariantScore>): number {
  const rate = (value: number, sent: number) => (sent > 0 ? value / sent : 0);
  const ranked = [...scores].sort(
    (a, b) =>
      rate(b.bought, b.sent) - rate(a.bought, a.sent) ||
      rate(b.revenue, b.sent) - rate(a.revenue, a.sent) ||
      rate(b.replied, b.sent) - rate(a.replied, a.sent) ||
      a.variant - b.variant
  );
  return ranked[0]?.variant ?? 0;
}
