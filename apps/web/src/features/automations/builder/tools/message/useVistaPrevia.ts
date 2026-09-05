import { useEffect, useSyncExternalStore } from "react";
import { alCambiarLaSesion, enlaceDeSesion } from "./mediaSourceSession";
import { alLlegarMiniatura, miniaturaYaObtenida, precalentarMiniatura } from "./mediaThumbnails";

// ---------------------------------------------------------------------------
// La imagen con la que se representa un medio, para quien la necesite.
//
// POR QUÉ EXISTE, Y POR QUÉ NO ES UN SEGUNDO SISTEMA
//
// Ya había un productor de fotogramas —`mediaThumbnails`— y un registro de
// archivos de la sesión —`mediaSourceSession`—. Lo que no había era forma de
// CONSUMIRLOS desde React, y eso costaba dos defectos distintos que parecían no
// tener nada que ver:
//
//   EN EL LIENZO   el nodo cerrado leía el registro durante el render, se
//                  montaba antes de que hubiera archivo y nadie volvía a
//                  avisarle: se quedaba con el icono para siempre. Medido: el
//                  fotograma listo a los 836ms, el nodo con el icono a los
//                  5200ms.
//   EN EL EDITOR   el `<video>` no tenía `poster`, así que hasta pulsar Play
//                  solo se veía el fondo de la caja. El fotograma ya existía —
//                  el mismo, a los 836ms— pero no llegaba hasta aquí.
//
// Los dos son el mismo agujero: faltaba el puente entre esos almacenes y React.
// Este archivo ES ese puente, y es el único. No produce fotogramas, no guarda
// archivos y no tiene caché propia — pregunta a los dos módulos que ya hacen
// esas dos cosas.
//
// SE USA `useSyncExternalStore` porque es exactamente el caso para el que
// existe: un dato que vive fuera de React, que muta cuando le parece y que hay
// que leer en el render. Hecho a mano —un `useState` y un efecto que se
// suscribe— habría vuelto a dejar el mismo hueco entre el montaje y la primera
// suscripción que causó el defecto del lienzo.
// ---------------------------------------------------------------------------

/**
 * El enlace del archivo que la sesión tiene para este bloque, si lo tiene.
 *
 * Reactivo: cuando el usuario elige un archivo en el editor, quien use esto se
 * entera, aunque esté en otra parte del árbol —el nodo del lienzo lo está—.
 */
export function useEnlaceDeSesion(itemId: string): string | null {
  return useSyncExternalStore(
    alCambiarLaSesion,
    () => enlaceDeSesion(itemId),
    // En el servidor no hay archivos de sesión: no hay `File`, ni Object URL,
    // ni pestaña. Decir «no hay» es la respuesta correcta y además evita que el
    // marcado del servidor y el del cliente discrepen.
    () => null
  );
}

/**
 * La imagen con la que representar una fuente, o `null` mientras no la haya.
 *
 * UNA SOLA PUERTA PARA LOS DOS CASOS, y la diferencia queda dentro:
 *
 *   IMAGEN  su fuente ya es pintable y se devuelve tal cual, al instante.
 *   VIDEO   hay que sacarle un fotograma. Se pide aquí, se espera sin bloquear
 *           y se devuelve en cuanto está.
 *
 * Quien llama no necesita saber cuál de los dos le ha tocado: pinta lo que
 * reciba, y mientras reciba `null` enseña lo que corresponda —el icono en el
 * lienzo, el fondo de la caja en el editor—.
 */
export function useVistaPrevia(fuente: string | null, esVideo: boolean): string | null {
  // El trabajo se pide desde un EFECTO, nunca desde la lectura de arriba: React
  // llama a `getSnapshot` cuando quiere, y arrancar una captura ahí sería un
  // efecto escondido dentro del render.
  //
  // Pedirlo dos veces no cuesta nada —el productor ignora lo que ya tiene o ya
  // está haciendo—, así que no hace falta coordinar nada entre los dos sitios
  // que llaman a esto.
  useEffect(() => {
    if (esVideo && fuente) precalentarMiniatura(fuente);
  }, [esVideo, fuente]);

  return useSyncExternalStore(
    alLlegarMiniatura,
    () => (fuente ? miniaturaYaObtenida(fuente, esVideo) : null),
    () => null
  );
}
