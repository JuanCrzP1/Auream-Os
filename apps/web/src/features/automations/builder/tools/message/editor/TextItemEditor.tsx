import { useCallback, useLayoutEffect, useRef } from "react";
import type { MessageTextItem } from "../types";

interface TextItemEditorProps {
  readonly item: MessageTextItem;
  readonly position: number;
  readonly onEdit: (change: { text: string }) => void;
}

/**
 * Cuerpo de un bloque de texto.
 *
 * EL ANCHO NO SE TOCA NUNCA. Se lee `scrollHeight` y se escribe `height`, y
 * nada más. El orden es el que impone el navegador: el ancho lo fija el
 * contenedor → el navegador reparte el texto en renglones → `scrollHeight`
 * refleja esos renglones → se ajusta el alto. Invertirlo —dimensionar por
 * contenido y dejar que el ancho siga— es lo que pone el texto en una línea.
 *
 * El campo arranca en tres renglones y crece hasta el tope del CSS; pasado el
 * tope desplaza dentro de sí, en vertical. El tope protege el marco: sin él un
 * mensaje largo estiraría el bloque, el bloque la secuencia y la secuencia el
 * nodo expandido, que tiene tamaño fijo por diseño.
 */
/**
 * ¿Sabe el navegador dimensionar el campo por su contenido él solo?
 *
 * Donde sí, NO se toca el alto desde JavaScript: un `height` en línea gana al
 * dimensionado nativo y congela la caja en el valor que tuviera al montarse —el
 * texto pasaba a cuatro renglones al estrechar el nodo y la caja se quedaba en
 * tres, con el resto oculto tras un scroll—. Un solo mecanismo por navegador,
 * nunca los dos compitiendo por la misma propiedad.
 */
const ALTO_NATIVO =
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("field-sizing", "content");

export function TextItemEditor({ item, position, onEdit }: TextItemEditorProps) {
  const campo = useRef<HTMLTextAreaElement>(null);
  const anchoPrevio = useRef(0);

  const ajustar = useCallback(() => {
    if (ALTO_NATIVO) return;
    const el = campo.current;
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

  useLayoutEffect(ajustar, [ajustar, item.text]);

  // Los renglones dependen del ANCHO, no solo del texto: al estrechar el bloque
  // las mismas palabras ocupan más líneas y el alto se queda corto.
  //
  // SE OBSERVA EL CONTENEDOR, NO EL CAMPO. Observar el propio textarea creaba
  // un bucle —el callback le escribe `height`, eso es un cambio de tamaño del
  // elemento observado, y el navegador corta la entrega de avisos—: el alto se
  // calculaba una vez al montar y no volvía a actualizarse jamás. El contenedor
  // manda el ancho y no lo cambiamos nosotros, así que no hay realimentación.
  useLayoutEffect(() => {
    const el = campo.current;
    const contenedor = el?.parentElement;
    if (ALTO_NATIVO || !el || !contenedor || typeof ResizeObserver === "undefined") return;

    anchoPrevio.current = contenedor.clientWidth;
    let pendiente = 0;

    const observador = new ResizeObserver(() => {
      const ancho = contenedor.clientWidth;
      // Solo el ancho reparte el texto. Reaccionar también al alto encadenaría
      // cada ajuste con el siguiente.
      if (ancho === anchoPrevio.current) return;
      anchoPrevio.current = ancho;

      // EL ALTO SE ESCRIBE FUERA DEL CALLBACK. Escribirlo aquí dentro cambia el
      // tamaño de un elemento dentro del observado, el navegador lo detecta
      // como bucle y DEJA DE ENTREGAR AVISOS: el alto se calculaba al montar y
      // no se actualizaba nunca más. Un fotograma después ya no hay bucle, y el
      // navegador ha aplicado el reparto de renglones al ancho nuevo antes de
      // que aquí se mida.
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
      <textarea
        ref={campo}
        className="message-item__text nodrag nowheel"
        value={item.text}
        onChange={(event) => onEdit({ text: event.target.value })}
        placeholder="Escribe tu mensaje"
        aria-label={`Texto del bloque ${position}`}
        /* Explícito aunque sea el valor por omisión: `wrap="off"` es la única
           forma de que un textarea deje de envolver, y dejarlo escrito impide
           que alguien lo cambie sin darse cuenta de lo que rompe. */
        wrap="soft"
        spellCheck
      />
    </div>
  );
}
