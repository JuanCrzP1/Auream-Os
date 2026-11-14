// ---------------------------------------------------------------------------
// «Lo de Auream / lo de Meta», con las mismas palabras en todo el producto.
//
//   - El número grande es de Auream (las ventas anotadas aquí).
//   - Si Auream aún no lo tiene y Meta sí lo reporta, va el de Meta con la
//     etiqueta «Meta» (`MetaTag`): nunca se confunde con una venta real.
//   - Lo que solo sale de las ventas reales (la ganancia, la conversión)
//     espera a que haya ventas en Auream: nunca se calcula con lo de Meta.
//   - Con ventas en Auream, lo de Meta va al lado: «Meta: $ 1.416.000».
//
// Un solo aviso arriba (`MeasurementNotice`) explica por qué; las tarjetas no
// repiten la explicación. Puro (sin React).
// ---------------------------------------------------------------------------

/** La ganancia y el ROAS real: necesitan las ventas de los anuncios en Auream. */
export const WAITS_FOR_AD_SALES = "Se calcula cuando tus anuncios vendan en Auream";
/** La conversión y lo que sale de todas las ventas. */
export const WAITS_FOR_SALES = "Se calcula cuando vendas en Auream";
/** La nota de un número que reporta Meta. */
export const META_REPORTS = "Lo que reporta Meta";
/** Lo que dice la etiqueta al pasar el mouse. */
export const META_TAG_HINT = "Este número lo reporta Meta. Cuando vendas en Auream, aquí van tus ventas reales.";

/** Lo de Meta al lado de lo de Auream: «Meta: 0,5x». */
export const metaBeside = (text: string) => `Meta: ${text}`;

/** «323 compras» / «1 compra». */
export const purchasesText = (count: number) => `${count.toLocaleString("es-CO")} ${count === 1 ? "compra" : "compras"}`;

/** Una división que no inventa: sin divisor no hay número. */
export const perUnit = (total: number, units: number): number | null => (units > 0 ? total / units : null);
