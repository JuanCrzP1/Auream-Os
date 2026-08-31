/**
 * Identidad de la plataforma.
 *
 * Responsabilidad única: ser el único lugar del código donde se escriben los
 * textos de marca. Cambiar la identidad debe ser cambiar estas constantes, no
 * buscar cadenas por toda la interfaz.
 *
 * Los assets visuales viven junto a este archivo y se consumen a través de
 * `AureamMark` y `AureamLogo`, nunca importando el PNG directamente.
 *
 * Hay una copia inevitable en `apps/web/index.html` (`<title>`): ese documento
 * se sirve antes de que arranque React, así que no puede importar de aquí. Si
 * cambia el nombre, actualiza también ese `<title>`.
 */

export const BRAND_NAME = "AUREAM OS";

/** Las tres capacidades que definen el producto. */
export const BRAND_TAGLINE = "AI Agents · Flows · Conversations";

/** Una frase: qué es la plataforma. */
export const BRAND_DESCRIPTION =
  "La plataforma inteligente para automatizar conversaciones y procesos.";
