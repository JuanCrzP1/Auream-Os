import type { ComponentType } from "react";
import type { IntervalTrigger } from "@contracts/IntervalConfig";

// ---------------------------------------------------------------------------
// Los signos del Programador.
//
// DOS DE MOMENTO PRINCIPAL Y UNO DE RESTRICCIÓN, y esa asimetría es el modelo:
// el reloj y el calendario son alternativas entre sí —se elige una—, mientras
// que los tramos son el signo de algo que se añade encima de cualquiera de las
// dos. Por eso `ICONO_DE_TRIGGER` tiene exactamente dos entradas y el horario
// se exporta suelto: no es un tercer caso del mismo mapa.
//
// VIVEN AQUÍ PORQUE LOS USAN DOS: el editor, para que cada sección se reconozca
// antes de leerla, y el nodo cerrado del lienzo, para que se reconozca qué clase
// de espera es sin abrirlo. Tenerlos en el editor y copiarlos al nodo habría
// sido dibujar dos veces el mismo reloj.
//
// SVG del sistema, nunca un emoji: mismo trazo de 1.6 y mismas terminaciones
// redondeadas que el resto de la iconografía del Builder, y `currentColor` para
// que cada sitio decida el tono —claro sobre el cyan del nodo, apagado en el
// selector en reposo— sin que el icono sepa dónde está.
// ---------------------------------------------------------------------------

/** Reloj: una espera que se cuenta desde ahora. */
export function IconoEspera() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10" cy="10.5" r="6.5" />
      <path d="M10 6.75v3.75l2.5 1.6" />
    </svg>
  );
}

/** Hoja de calendario: un día concreto, marcado. */
export function IconoFecha() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
      <path d="M3 8.5h14M7 2.75v3M13 2.75v3" />
      <circle cx="10" cy="12.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Tramos repetidos: una ventana que vuelve cada semana. */
export function IconoHorario() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M3 6.5h7M3 10.5h11M3 14.5h5" />
      <circle cx="15.5" cy="6.5" r="1.6" />
      <circle cx="16.5" cy="10.5" r="1.6" />
    </svg>
  );
}

/**
 * El signo de cada momento principal. Un mapa, no un `if`.
 *
 * SOLO LOS DOS TRIGGERS. El horario no está: no es un momento principal, y
 * meterlo aquí volvería a sugerir que los tres son lo mismo. Quien lo necesita
 * importa `IconoHorario` directamente.
 */
export const ICONO_DE_TRIGGER: Readonly<Record<IntervalTrigger, ComponentType>> = {
  interval: IconoEspera,
  date: IconoFecha
};
