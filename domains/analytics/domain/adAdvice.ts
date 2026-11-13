import type { AdMeasurement } from "../../../contracts/AdMeasurementContracts";
import type { AdAdvice } from "../../../contracts/DashboardContracts";
import { META_SALES_GAP } from "./adMeasurement";

// ---------------------------------------------------------------------------
// Qué hacer con una campaña, conjunto o anuncio, según lo que vendió DE VERDAD
// (no lo que cree Meta). Reglas simples y explicables, como las diría un
// buen trafficker. Primero, si hay con qué juzgar: sin datos no hay veredicto.
//
//   sin medir         Meta cobra chats y a Auream no llega ninguno
//   medición parcial  a Auream llegó menos de la mitad de esos chats
//   aprendiendo       gastó poco: aún no hay con qué juzgar
//   sin ventas        los chats llegan, pero el negocio no anota ventas
//   apagar            gastó lo de 3 ventas (o 15 chats) y no vendió nada
//   escalar           deja 3 o más por cada 1 y ya vendió 3 veces o más
//   revisar           deja menos de 1,5 por cada 1
//   mantener          lo demás
// ---------------------------------------------------------------------------

export interface AdviceInput {
  readonly spend: number;
  readonly sales: number;
  readonly chats: number;
  readonly roas: number | null;
  /** Lo que cuesta una venta en toda la cuenta (la vara de medir). */
  readonly accountCostPerSale: number | null;
  /** Cuánto ve Auream de lo que vende (`measurementOf`). */
  readonly measurement: AdMeasurement;
}

export const SCALE_ROAS = 3;
export const REVIEW_ROAS = 1.5;

const count = (value: number) => value.toLocaleString("es-CO");

export function adviceFor(input: AdviceInput): { readonly advice: AdAdvice; readonly reason: string } {
  const seen = input.measurement;
  if (seen.state === "none") return { advice: "unmeasured", reason: `Sus ${count(seen.metaChats)} chats no llegan a Auream: no hay con qué juzgarla.` };
  if (seen.state === "partial") {
    return { advice: "partial", reason: `A Auream llegaron ${count(seen.arrivedChats)} de ${count(seen.metaChats)} chats: aún no se puede juzgar.` };
  }
  // Que Meta cuente ventas donde Auream no ve ninguna ya es una señal, haya gastado mucho o poco.
  if (seen.state === "unsold" && seen.metaPurchases >= META_SALES_GAP) {
    return { advice: "unsold", reason: `Meta cuenta ${count(seen.metaPurchases)} ventas y Auream ninguna: revisa que se estén anotando.` };
  }
  const benchmark = input.accountCostPerSale ?? 0;
  const enoughSpend = benchmark > 0 ? input.spend >= benchmark : input.chats >= 5;
  if (!enoughSpend && input.sales === 0) return { advice: "learning", reason: "Gastó poco: aún no hay con qué juzgarla." };
  if (seen.state === "unsold") return { advice: "unsold", reason: "Auream no ve ventas tuyas: anótalas para poder juzgarla." };
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
