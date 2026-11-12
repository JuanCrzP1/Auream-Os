// ---------------------------------------------------------------------------
// La frase que resume una línea mientras se arma («Venezuela mide las ventas
// de Mega Pack en todos tus números, con el gasto de 1 campaña…»). Pura.
// ---------------------------------------------------------------------------

export interface LineDraftNames {
  readonly name: string;
  readonly products: ReadonlyArray<string>;
  readonly numbers: ReadonlyArray<string>;
  readonly campaigns: ReadonlyArray<string>;
}

const listOf = (names: ReadonlyArray<string>) =>
  names.length <= 2 ? names.join(" y ") : `${names.slice(0, 2).join(", ")} y ${names.length - 2} más`;

export function lineSentence(draft: LineDraftNames): string {
  const name = draft.name.trim() || "Esta línea";
  const sales = draft.products.length ? `las ventas de ${listOf(draft.products)}` : "las ventas que trajeron sus campañas";
  const where = draft.numbers.length ? `por ${listOf(draft.numbers)}` : "en todos tus números";
  const spend = draft.campaigns.length
    ? `con el gasto de ${draft.campaigns.length === 1 ? `1 campaña (${draft.campaigns[0]})` : `${draft.campaigns.length} campañas`}. Su ROAS y su ganancia salen solo de eso.`
    : "sin campañas: verás sus ventas, pero no su gasto ni su ROAS.";
  return `${name} mide ${sales} ${where}, ${spend}`;
}
