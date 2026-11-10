import type { AdAdvice } from "../../../contracts/DashboardContracts";

// ---------------------------------------------------------------------------
// Qué hacer con una campaña, conjunto o anuncio, según lo que vendió DE VERDAD
// (no lo que cree Meta). Reglas simples y explicables, como las diría un
// buen trafficker:
//
//   aprendiendo  gastó poco: aún no hay con qué juzgar
//   apagar       gastó lo de 3 ventas (o 15 chats) y no vendió nada
//   escalar      deja 3 o más por cada 1 y ya vendió 3 veces o más
//   revisar      deja menos de 1,5 por cada 1
//   mantener     lo demás
// ---------------------------------------------------------------------------

export interface AdviceInput {
  readonly spend: number;
  readonly sales: number;
  readonly chats: number;
  readonly roas: number | null;
  /** Lo que cuesta una venta en toda la cuenta (la vara de medir). */
  readonly accountCostPerSale: number | null;
}

export const SCALE_ROAS = 3;
export const REVIEW_ROAS = 1.5;

export function adviceFor(input: AdviceInput): { readonly advice: AdAdvice; readonly reason: string } {
  const benchmark = input.accountCostPerSale ?? 0;
  const enoughSpend = benchmark > 0 ? input.spend >= benchmark : input.chats >= 5;
  if (!enoughSpend && input.sales === 0) return { advice: "learning", reason: "Gastó poco: aún no hay con qué juzgarla." };
  if (input.sales === 0 && ((benchmark > 0 && input.spend >= 3 * benchmark) || input.chats >= 15)) {
    return { advice: "pause", reason: `${input.chats} chats y ninguna venta.` };
  }
  if (input.roas !== null && input.roas >= SCALE_ROAS && input.sales >= 3) {
    return { advice: "scale", reason: `Deja ${formatTimes(input.roas)} por cada 1 que gastas.` };
  }
  if (input.roas !== null && input.roas < REVIEW_ROAS) {
    return { advice: "review", reason: input.roas < 1 ? "Gasta más de lo que vende." : "Apenas cubre su gasto." };
  }
  return { advice: "keep", reason: "Rinde bien; sigue mirándola." };
}

export function formatTimes(value: number): string {
  return `${value.toLocaleString("es-CO", { maximumFractionDigits: 1 })}`;
}
