import type { ComponentType } from "react";
import type { MessageMediaItem } from "./types";
import { esEnlaceUsable } from "./mediaSource";
import { useEnlaceDeSesion, useVistaPrevia } from "./useVistaPrevia";

interface MediaBlockThumbnailProps {
  readonly item: MessageMediaItem;
  /** Icono oficial del tipo. Es lo que se pinta si no hay miniatura. */
  readonly Icon: ComponentType;
}

/** Tipos que tienen algo visual que enseñar en 38px. */
const CON_MINIATURA: ReadonlyArray<MessageMediaItem["kind"]> = ["image", "video"];

/**
 * Lo que va a la izquierda de una fila del preview: una miniatura o el icono.
 *
 * AQUÍ VIVE LA DIFERENCIA POR TIPO, y en ningún otro sitio del preview. Imagen
 * y Video comparten camino —los dos piden una miniatura por la misma puerta—;
 * Audio y Archivo no tienen nada que enseñar en 38px y se quedan con su icono
 * oficial, que es lo que de verdad los identifica.
 *
 * NUNCA MONTA UN MEDIO. Lo que se pinta es siempre un `<img>`: para una imagen
 * es su propia fuente, y para un video, el fotograma que `mediaThumbnails` haya
 * conseguido sacar aparte. En el lienzo no hay reproductores, ni controles, ni
 * elementos `<video>` — ni siquiera ocultos.
 *
 * ESPERAR NO BLOQUEA. Mientras el fotograma no está, se pinta el icono; cuando
 * llega, este componente se entera y lo cambia. Si no llega nunca —códec, CORS,
 * URL muerta— el icono se queda, y eso es un final correcto, no un fallo.
 */
export function MediaBlockThumbnail({ item, Icon }: MediaBlockThumbnailProps) {
  const esVideo = item.kind === "video";
  const puedeTenerMiniatura = CON_MINIATURA.includes(item.kind);

  // LAS DOS FUENTES, EN EL ORDEN EN QUE GANAN —el mismo que usa la validación—:
  // el ENLACE, que sobrevive a todo, y el ARCHIVO de la sesión, que solo vive
  // mientras la pestaña siga abierta. Qué enlace sirve lo decide `mediaSource`,
  // el mismo módulo que consulta la validación: no hay dos criterios.
  //
  // El archivo se pregunta con un hook y no con una lectura suelta, y esa es
  // toda la diferencia con lo que había: la sesión cambia cuando el usuario
  // elige un archivo en el editor —en otra rama del árbol—, y sin suscripción
  // este nodo no se enteraba nunca. Se montaba sin archivo y se quedaba con el
  // icono aunque el fotograma estuviese listo.
  const enlace = item.url.trim();
  const deLaSesion = useEnlaceDeSesion(item.id);
  const fuente = esEnlaceUsable(enlace) ? enlace : deLaSesion;

  const miniatura = useVistaPrevia(puedeTenerMiniatura ? fuente : null, esVideo);

  if (miniatura) {
    return <img className="flow-node__block-thumb" src={miniatura} alt="" />;
  }

  return (
    <span className="flow-node__block-badge" aria-hidden="true">
      <Icon />
    </span>
  );
}
