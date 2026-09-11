import { readDistributorOutputs } from "./readDistributorConfig";

/**
 * Cómo se lee un reparto en una línea. Singular y plural, sin «1 salidas».
 *
 * Exportado porque el cuerpo compacto dice exactamente lo mismo en su cabecera:
 * una sola forma de contar salidas en todo el producto.
 */
export function describirSalidas(cuantas: number): string {
  if (cuantas === 0) return "Sin salidas";

  return cuantas === 1 ? "1 salida" : `${cuantas} salidas`;
}

/**
 * Resumen de un Distribuidor para la tarjeta del lienzo, cerrada.
 *
 * DERIVADO, nunca fuente de verdad: es una lectura de `config`.
 *
 * CUENTA, NO ENUMERA. Con cinco salidas, listarlas aquí llenaría la línea de
 * rótulos que ya se leen uno debajo de otro en el propio nodo. Lo que este
 * resumen responde es «cuánto reparte este nodo», que es lo que necesita quien
 * NO tiene cuerpo compacto delante: la paleta y el inspector.
 */
export function summarizeDistributor(
  _content: Readonly<Record<string, unknown>>,
  config: Readonly<Record<string, unknown>>
): string {
  return describirSalidas(readDistributorOutputs(config).length);
}
