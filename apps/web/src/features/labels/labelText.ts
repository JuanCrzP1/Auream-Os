import type { LabelSales, LabelUse } from "@contracts/LabelManagementContracts";
import { formatMoneyShort } from "@shared/format/formatMoney";

// ---------------------------------------------------------------------------
// Cómo se dicen las cosas en Etiquetas: quién la usa («Etapa · Ventas · 3
// flujos · 1 difusión»), lo que vendieron (sin mezclar monedas) y adónde
// lleva cada uso. Puro.
// ---------------------------------------------------------------------------

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Caracteres que no se ven (como los que trae WhatsApp al copiar una etiqueta). */
const INVISIBLE = /[\p{Cf}\u00A0\u2000-\u200A\u202F\u205F\u3000]/u;

/** ¿Tiene caracteres que no se ven? Es lo que hace que dos etiquetas «iguales» sean distintas. */
export const hasHiddenChars = (name: string) => INVISIBLE.test(name);

/** El nombre como para elegirlo: la que tiene caracteres invisibles lo dice, para distinguirla de su gemela. */
export const labelDisplayName = (name: string) => (hasHiddenChars(name) ? `${name.replace(new RegExp(INVISIBLE, "gu"), "").trim()} (con un carácter invisible)` : name);

/** La etapa del embudo, si es una. */
export const stageOf = (uses: ReadonlyArray<LabelUse>) => uses.find((use): use is Extract<LabelUse, { kind: "stage" }> => use.kind === "stage") ?? null;

/** Lo demás, contado: «3 flujos · 1 difusión · 1 webhook». Los bloques de un mismo flujo cuentan como un flujo. */
export function usesText(uses: ReadonlyArray<LabelUse>): string {
  const flows = new Set(uses.flatMap((use) => (use.kind === "flow" ? [use.flowKey] : []))).size;
  const count = (kind: LabelUse["kind"]) => uses.filter((use) => use.kind === kind).length;
  return [
    flows ? plural(flows, "flujo", "flujos") : "",
    count("broadcast") ? plural(count("broadcast"), "difusión", "difusiones") : "",
    count("audience") ? plural(count("audience"), "público guardado", "públicos guardados") : "",
    count("webhook") ? plural(count("webhook"), "webhook", "webhooks") : "",
    count("groupCampaign") ? plural(count("groupCampaign"), "campaña de grupos", "campañas de grupos") : ""
  ]
    .filter(Boolean)
    .join(" · ");
}

/** «$ 9,8 M COP», y «+1 moneda» si vendieron en otras (nunca se suman monedas distintas). */
export function salesText(sales: ReadonlyArray<LabelSales> | null): { readonly text: string; readonly title?: string } | null {
  if (sales === null) return null;
  const [main, ...rest] = sales;
  if (!main) return { text: "—" };
  const others = rest.length > 0 ? ` · +${plural(rest.length, "moneda", "monedas")}` : "";
  return { text: `${formatMoneyShort(main.amount, main.currency)}${others}`, title: sales.map((row) => `${formatMoneyShort(row.amount, row.currency)} en ${plural(row.sales, "venta", "ventas")}`).join(" · ") };
}

/** Qué hace este uso, en palabras. */
export function useText(use: LabelUse): { readonly title: string; readonly detail: string; readonly to: string } {
  switch (use.kind) {
    case "stage":
      return { title: `Etapa del embudo «${use.pipelineName}»`, detail: "Tener la etiqueta es estar en esa etapa", to: "/crm" };
    case "flow":
      return {
        title: use.blockName,
        detail: `Flujo «${use.flowName}» · ${use.how === "adds" ? "la pone" : use.how === "removes" ? "la quita" : "pregunta si la tiene"}`,
        to: `/builder/${encodeURIComponent(use.flowKey)}`
      };
    case "broadcast":
      return { title: use.name, detail: "Difusión por enviar · filtra por ella", to: "/broadcasts" };
    case "audience":
      return { title: use.name, detail: "Público guardado de Difusiones", to: "/broadcasts" };
    case "webhook":
      return { title: use.name, detail: "Webhook · la pone o la quita", to: "/integrations" };
    case "groupCampaign":
      return { title: use.name, detail: "Campaña de grupos · la pone con su nombre a quien entra", to: "/groups" };
  }
}
