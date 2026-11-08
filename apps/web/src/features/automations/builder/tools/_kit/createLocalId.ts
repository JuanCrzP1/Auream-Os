/**
 * Identificador local único para entidades creadas en el navegador
 * (bloques, salidas, aristas).
 *
 * Marca de tiempo + secuencia + sufijo aleatorio: dos llamadas en el mismo
 * milisegundo, o tras recargar la página, no colisionan. Puro y sin DOM.
 */
let sequence = 0;

export function createLocalId(prefix: string): string {
  sequence += 1;
  const random = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}${random}`;
}
