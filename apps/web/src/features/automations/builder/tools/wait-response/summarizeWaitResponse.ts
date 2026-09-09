import { readWaitResponseConfig, type WaitResponseConfig } from "@contracts/WaitResponseConfig";

/**
 * Cómo se lee una espera en una línea. Singular y plural, sin `1 minutos`.
 *
 * Exportado porque el cuerpo compacto pinta exactamente la misma frase en su
 * fila de datos: una sola forma de decir «30 minutos» en todo el producto.
 */
export function describirEspera(config: WaitResponseConfig): string {
  if (config.waitIndefinitely || !config.timeout) return "Sin límite";

  const { amount, unit } = config.timeout;
  const nombre =
    unit === "hours"
      ? amount === 1 ? "hora" : "horas"
      : amount === 1 ? "minuto" : "minutos";

  return `${amount} ${nombre}`;
}

/**
 * Resumen de un «Esperar respuesta» para la tarjeta del lienzo, cerrada.
 *
 * DERIVADO, nunca fuente de verdad: es una lectura de `content` y `config`.
 *
 * FORMATO: «<espera> · Guarda en <campo>», y solo la primera mitad cuando no hay
 * campo destino. Es deliberadamente CORTO —dos datos como mucho— porque la
 * tarjeta cerrada es un resumen y no una copia del editor: agrupar, citar y
 * reaccionar están configurados y no se enumeran aquí, que llenaría la línea de
 * detalles que no responden a «qué hace este nodo».
 *
 * El mensaje previo tampoco entra: lo enseña `WaitResponseCompactBody` en su
 * propia fila, con sitio para leerse. Este resumen es el que ve quien NO tiene
 * cuerpo compacto —la paleta, el inspector— y ahí lo que importa es la espera.
 */
export function summarizeWaitResponse(
  _content: Readonly<Record<string, unknown>>,
  config: Readonly<Record<string, unknown>>
): string {
  const leida = readWaitResponseConfig(config);
  const espera = describirEspera(leida);

  return leida.targetKey ? `${espera} · Guarda en ${leida.targetKey}` : espera;
}
