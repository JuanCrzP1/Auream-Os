import type { FxRatesResponse } from "@contracts/DashboardContracts";

// ---------------------------------------------------------------------------
// Cómo se dicen las tasas oficiales en el menú de moneda: «1 USD = 904,45» al
// lado de cada moneda y, abajo, de cuándo son y de dónde salen. Puro.
// ---------------------------------------------------------------------------

/** «1 USD = 904,45» para una moneda; `null` para el dólar o si no hay tasa. */
export function rateHint(fx: FxRatesResponse | null, code: string): string | null {
  if (!fx || code === "USD") return null;
  const rate = fx.rates.find((item) => item.currency === code);
  return rate ? `1 USD = ${rate.perUsd.toLocaleString("es-CO", { maximumFractionDigits: rate.perUsd < 10 ? 4 : 2 })}` : null;
}

/** «Tasas oficiales del 12 de nov (actualizadas 8:02 p. m.). … El bolívar es la tasa oficial del BCV.» */
export function ratesNote(fx: FxRatesResponse | null): string {
  if (!fx?.day || !fx.updatedAt) return "Lo vendido en otras monedas se convierte con la tasa oficial de cada día.";
  const day = new Date(`${fx.day}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  const time = new Date(fx.updatedAt).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  const bolivar = fx.rates.find((item) => item.currency === "VES")?.source === "bcv" ? " El bolívar es la tasa oficial del BCV." : "";
  return `Tasas oficiales del ${day} (actualizadas ${time}). Cada venta se convierte con la tasa de su día.${bolivar}`;
}
