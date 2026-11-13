// ---------------------------------------------------------------------------
// Cuánto ve Auream de lo que venden los anuncios. El gasto y los chats los
// reporta Meta; la venta real solo existe si el chat llegó a Auream por ese
// anuncio y la venta quedó anotada. Sin eso no hay con qué juzgar una campaña:
// «no tengo datos» nunca se muestra como «no vendió».
//
//   measured  llegan los chats y se anotan ventas: se puede juzgar
//   partial   a Auream llegó menos de la mitad de los chats que cobró Meta
//   unsold    los chats llegan, pero no hay ventas anotadas de esos clientes
//   none      Meta cobra chats y a Auream no llegó ninguno
// ---------------------------------------------------------------------------

export type AdMeasurementState = "measured" | "partial" | "unsold" | "none";

export interface AdMeasurement {
  readonly state: AdMeasurementState;
  /** Chats que cobró Meta en el periodo. */
  readonly metaChats: number;
  /** Clientes que llegaron a Auream por esos anuncios en el periodo. */
  readonly arrivedChats: number;
  /** Compras que reporta Meta (su Píxel). */
  readonly metaPurchases: number;
}

/**
 * Sin ventas que mirar, el ROAS real y la ganancia no se conocen (no son 0).
 * Con medición parcial, las ventas que ya hay son un piso y se muestran; si
 * aún no hay ninguna, tampoco se sabe nada.
 */
export const salesUnknown = (seen: AdMeasurement, sales: number): boolean =>
  seen.state === "none" || seen.state === "unsold" || (seen.state === "partial" && sales === 0);
