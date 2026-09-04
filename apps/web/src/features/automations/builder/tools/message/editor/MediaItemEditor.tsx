import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { MessageMediaItem } from "../types";
import { MediaSourceTabs, type MediaSource } from "./MediaSourceTabs";
import { FileSource } from "./FileSource";
import { UrlSource } from "./UrlSource";
import { SendOnceSwitch } from "./SendOnceSwitch";

/**
 * Rótulo y ejemplo de la descripción, por tipo.
 *
 * Contextuales a propósito: «Descripción opcional» obliga al usuario a deducir
 * de qué está describiendo, y en una secuencia con seis bloques esa deducción
 * se repite seis veces.
 */
const DESCRIPCION: Readonly<
  Record<MessageMediaItem["kind"], { label: string; placeholder: string }>
> = {
  image: { label: "Descripción de la imagen", placeholder: "Describe brevemente esta imagen…" },
  video: { label: "Descripción del video", placeholder: "Describe brevemente este video…" },
  audio: { label: "Descripción del audio", placeholder: "Describe brevemente este audio…" },
  file: { label: "Descripción del archivo", placeholder: "Describe brevemente este archivo…" }
};

interface MediaItemEditorProps {
  readonly item: MessageMediaItem;
  readonly position: number;
  readonly onEdit: (
    change: { url: string } | { caption: string } | { sendOnce: boolean }
  ) => void;
}

/**
 * ¿Sabe el navegador dimensionar el campo por su contenido él solo?
 *
 * Propia de este campo, no importada de `TextItemEditor`: son dos contenidos
 * distintos —aquí el tope es mucho más bajo, porque la descripción es
 * secundaria frente al área de carga— y cada uno lleva su propia constante.
 * Donde el navegador soporta `field-sizing`, el alto NO se toca desde
 * JavaScript: un `height` en línea gana al dimensionado nativo y lo congela en
 * el valor que tuviera al montarse.
 */
const ALTO_NATIVO =
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("field-sizing", "content");

/**
 * Cuerpo de un bloque de imagen, video, audio o archivo.
 *
 * Compone cuatro piezas y no implementa ninguna: las pestañas, la zona de
 * archivo, el campo de enlace y la descripción. Los cuatro tipos usan
 * exactamente el mismo código; lo único que cambia entre ellos es el acento,
 * que heredan del bloque, y las etiquetas, que salen del tipo.
 *
 * LA PESTAÑA ES ESTADO DE INTERFAZ, NO CONFIGURACIÓN. Vive aquí, arranca
 * siempre en «Archivo» y no viaja al snapshot: qué pestaña miraba el usuario no
 * es parte de lo que su mensaje dice, y guardarlo ensuciaría el flujo con
 * información de la sesión de edición.
 *
 * El archivo elegido tampoco se guarda —ver `FileSource`—. Lo que sí se escribe
 * en el bloque es el enlace, porque es lo único que hoy puede viajar de verdad
 * hasta el motor.
 */
export function MediaItemEditor({ item, position, onEdit }: MediaItemEditorProps) {
  const [source, setSource] = useState<MediaSource>("file");
  const [file, setFile] = useState<File | null>(null);

  const descripcion = useRef<HTMLTextAreaElement>(null);
  const anchoPrevio = useRef(0);

  const ajustar = useCallback(() => {
    if (ALTO_NATIVO) return;
    const el = descripcion.current;
    if (!el) return;

    // Medir desde cero antes de fijar: `scrollHeight` se mide contra la altura
    // actual, así que sin este reinicio el campo crecería al escribir pero no
    // volvería a bajar al borrar.
    el.style.height = "auto";
    const alto = el.scrollHeight;
    // `scrollHeight` es 0 donde no hay maquetación —jsdom—. Fijar «0px» ahí
    // sería peor que no tocar nada: el mínimo del CSS ya gobierna.
    if (alto > 0) el.style.height = `${alto}px`;
  }, []);

  useLayoutEffect(ajustar, [ajustar, item.caption]);

  // Los renglones dependen del ANCHO, no solo del texto: al estrechar el
  // bloque las mismas palabras ocupan más líneas y el alto se queda corto.
  //
  // SE OBSERVA EL CONTENEDOR, NO EL CAMPO. Observar el propio campo crea un
  // bucle —el callback le escribe `height`, eso es un cambio de tamaño del
  // elemento observado, y el navegador corta la entrega de avisos—: el alto se
  // calcularía una vez al montar y no volvería a actualizarse jamás.
  useLayoutEffect(() => {
    const el = descripcion.current;
    const contenedor = el?.parentElement;
    if (ALTO_NATIVO || !el || !contenedor || typeof ResizeObserver === "undefined") return;

    anchoPrevio.current = contenedor.clientWidth;
    let pendiente = 0;

    const observador = new ResizeObserver(() => {
      const ancho = contenedor.clientWidth;
      if (ancho === anchoPrevio.current) return;
      anchoPrevio.current = ancho;

      // El alto se escribe FUERA del callback, un fotograma después: escribirlo
      // aquí dentro es lo que crea el bucle de arriba.
      cancelAnimationFrame(pendiente);
      pendiente = requestAnimationFrame(ajustar);
    });

    observador.observe(contenedor);
    return () => {
      cancelAnimationFrame(pendiente);
      observador.disconnect();
    };
  }, [ajustar]);

  return (
    <div className="message-item__body">
      <MediaSourceTabs active={source} onChange={setSource} position={position} />

      {source === "file" ? (
        <FileSource kind={item.kind} position={position} file={file} onPick={setFile} />
      ) : (
        <UrlSource
          kind={item.kind}
          position={position}
          url={item.url}
          onChange={(url) => onEdit({ url })}
        />
      )}

      {/* Propiedad secundaria del contenido, no un campo suelto debajo del
          bloque: rótulo propio, superficie hundida y el mismo radio que el
          resto. Va DESPUÉS del área de carga porque describe lo que se ha
          elegido, no algo que haya que decidir antes.

          ES UN TEXTAREA, NO UN INPUT: un input de una sola línea no tiene
          mecanismo de wrapping — su valor se desplaza internamente sin
          importar qué diga el CSS. La descripción es texto libre y puede
          ocupar más de un renglón, así que necesita el elemento que sabe
          hacerlo. */}
      <label className="media-caption">
        <span className="media-caption__label">{DESCRIPCION[item.kind].label}</span>
        <textarea
          ref={descripcion}
          className="media-caption__input nodrag nowheel"
          value={item.caption}
          onChange={(event) => onEdit({ caption: event.target.value })}
          placeholder={DESCRIPCION[item.kind].placeholder}
          wrap="soft"
        />
      </label>

      <SendOnceSwitch
        checked={item.sendOnce}
        onChange={(sendOnce) => onEdit({ sendOnce })}
        position={position}
      />
    </div>
  );
}
