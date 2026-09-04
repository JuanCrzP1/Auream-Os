import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MessageIntervalItem, MessageIntervalUnit } from "../types";
import { MESSAGE_INTERVAL_UNITS } from "../messageItems";

interface IntervalItemEditorProps {
  readonly item: MessageIntervalItem;
  readonly position: number;
  readonly onEdit: (change: { amount: number } | { unit: MessageIntervalUnit }) => void;
}

/**
 * Hasta dónde llega el deslizador en cada unidad.
 *
 * Es un tope del CONTROL, no del dato: el campo numérico sigue admitiendo
 * cualquier duración, y si la que hay guardada supera el tope el propio
 * deslizador se estira para representarla en vez de mentir sobre ella.
 */
const TOPE: Readonly<Record<MessageIntervalUnit, number>> = {
  seconds: 60,
  minutes: 60,
  hours: 24
};

/** Alto aproximado del menú, para decidir si abre hacia abajo o hacia arriba. */
const ALTO_MENU = MESSAGE_INTERVAL_UNITS.length * 30 + 10;

/** Ancho mínimo del menú: «segundos» es la más larga de las tres. */
const ANCHO_MENU = 112;

interface CajaMenu {
  readonly top: number;
  readonly left: number;
  readonly minWidth: number;
}

/**
 * Selector de unidad propio del bloque.
 *
 * Es un `<select>` MENOS, y a propósito: el menú desplegado de un `select` lo
 * pinta el sistema operativo —fondo blanco, resalte azul— y no hay CSS que lo
 * alcance, así que dentro de un editor oscuro se abría como un agujero. Aquí
 * el menú es DOM propio y por tanto sigue el tema como todo lo demás.
 *
 * SALE DE LA TARJETA POR UN PORTAL, y esto no es opcional. `.message-item`
 * recorta lo que se salga (`overflow: hidden`) y la secuencia además
 * desplaza, así que un menú anclado dentro se cortaría por dos sitios. Pero
 * `position: fixed` TAMPOCO basta estando dentro: la tarjeta lleva una
 * animación de entrada con `transform` en sus fotogramas, y un antepasado con
 * transform se convierte en el contenedor de referencia de todo `fixed` que
 * tenga debajo — comprobado en render real, el menú aparecía desplazado a la
 * derecha y contando como desbordamiento del bloque. Montándolo en
 * `.message-editor` no hay ningún transform por medio y el `fixed` vuelve a
 * anclarse a la pantalla.
 *
 * Se monta ahí y no en `document.body` a propósito: dentro de `.message-editor`
 * el menú sigue heredando las variables de tema del módulo, así que el cyan le
 * llega solo en claro y en oscuro.
 *
 * Es LOCAL a Intervalo. No se generaliza a un sistema de desplegables porque
 * hoy no hay un segundo caso, y un componente compartido escrito para uno solo
 * acaba deformándose en cuanto aparece el segundo.
 */
function UnitPicker({
  value,
  position,
  onChange
}: {
  readonly value: MessageIntervalUnit;
  readonly position: number;
  readonly onChange: (unit: MessageIntervalUnit) => void;
}) {
  const [caja, setCaja] = useState<CajaMenu | null>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const abierto = caja !== null;

  const etiqueta =
    MESSAGE_INTERVAL_UNITS.find((unidad) => unidad.value === value)?.label ?? value;

  /** Dónde se monta el menú: el editor, que no recorta ni transforma. */
  const anfitrion = () =>
    disparador.current?.closest<HTMLElement>(".message-editor") ?? null;

  const abrir = () => {
    const marco = disparador.current?.getBoundingClientRect();
    if (!marco) return;
    // Si no cabe debajo se abre hacia arriba: el menú nunca debe salirse de la
    // pantalla ni quedar a medias.
    const cabeDebajo = window.innerHeight - marco.bottom > ALTO_MENU + 8;
    const ancho = Math.max(marco.width, ANCHO_MENU);
    setCaja({
      top: cabeDebajo ? marco.bottom + 6 : marco.top - ALTO_MENU - 6,
      // Topado contra el borde derecho: sin esto, un bloque pegado a la
      // derecha abría el menú medio fuera de la pantalla.
      left: Math.min(Math.max(8, marco.left), window.innerWidth - ancho - 8),
      minWidth: ancho
    });
  };

  useEffect(() => {
    if (!abierto) return;

    const cerrar = () => setCaja(null);

    const fuera = (evento: MouseEvent) => {
      const destino = evento.target as Node;
      if (menu.current?.contains(destino) || disparador.current?.contains(destino)) return;
      cerrar();
    };

    const tecla = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape") return;
      // El marco del nodo también escucha Escape —en `window`— para cerrarse
      // entero. Este manejador vive en `document`, que va ANTES en el camino
      // del evento, así que detenerlo aquí impide que el mismo Escape que
      // descarta este menú cierre además el editor y se lleve por delante lo
      // que el usuario llevaba escrito sin confirmar.
      //
      // Solo puede ocurrir con el menú abierto: este efecto no se registra
      // mientras está cerrado, así que Escape sigue cerrando el editor cuando
      // no hay ningún desplegable delante.
      evento.stopPropagation();
      cerrar();
      disparador.current?.focus();
    };

    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    // El menú vive en coordenadas de pantalla: si la secuencia se desplaza, el
    // control se mueve y el menú no. Cerrarlo es más honesto que dejarlo
    // flotando lejos de aquello que lo abrió.
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);

    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
    };
  }, [abierto]);

  return (
    <span className="message-interval__unit-wrap">
      <button
        ref={disparador}
        type="button"
        className="message-interval__unit nodrag"
        aria-label={`Unidad de la pausa del bloque ${position}`}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => (abierto ? setCaja(null) : abrir())}
      >
        {etiqueta}
        <span className="message-interval__caret" aria-hidden="true" />
      </button>

      {caja &&
        anfitrion() &&
        createPortal(
          <div
            ref={menu}
            className="message-interval__menu nodrag nowheel"
            role="listbox"
            aria-label={`Unidades para el bloque ${position}`}
            style={{ top: caja.top, left: caja.left, minWidth: caja.minWidth }}
          >
            {MESSAGE_INTERVAL_UNITS.map((unidad) => (
              <button
                key={unidad.value}
                type="button"
                role="option"
                aria-selected={unidad.value === value}
                className={`message-interval__option${
                  unidad.value === value ? " message-interval__option--active" : ""
                }`}
                onClick={() => {
                  onChange(unidad.value);
                  setCaja(null);
                  disparador.current?.focus();
                }}
              >
                {unidad.label}
              </button>
            ))}
          </div>,
          anfitrion()!
        )}
    </span>
  );
}

/**
 * Cuerpo de una pausa entre bloques.
 *
 * Misma estructura que el resto —rótulo, control— para que Intervalo no se lea
 * como un bloque de segunda. Lo que cambia es el acento, que hereda del bloque,
 * y el control, que aquí es una duración.
 *
 * Es el bloque MÁS COMPACTO del editor y debe seguir siéndolo: una pausa se
 * configura en dos segundos y no compite en presencia con el contenido que
 * separa. Por eso solo lleva lo imprescindible —cuánto, en qué unidad, y una
 * forma rápida de moverlo— y nada más.
 *
 * Guarda la duración; no la ejecuta. Cómo se traduce una pausa dentro de la
 * secuencia a comportamiento del motor se decidirá al construir la herramienta
 * Intervalo del lienzo, que es otra cosa —esa suspende la sesión entera— y no
 * debe resolverse de refilón aquí. El dato queda bien modelado para entonces.
 */
export function IntervalItemEditor({ item, position, onEdit }: IntervalItemEditorProps) {
  // El deslizador se estira si el valor guardado supera el tope de su unidad,
  // para que el pulsador nunca aparezca clavado al final representando otra
  // cosa distinta de la que hay.
  const tope = Math.max(TOPE[item.unit], item.amount);
  const relleno = ((item.amount - 1) / Math.max(tope - 1, 1)) * 100;

  return (
    <div className="message-item__body">
      {/* SIN RÓTULO VISIBLE, y no por ahorrar: «Pausa antes del siguiente
          bloque» ocupaba una fila entera para repetir lo que ya dicen el
          nombre del bloque —INTERVALO, en su cabecera— y el propio valor
          —«24 segundos»—. Una línea que no añade nada en un bloque que existe
          para ser el más corto del editor.

          Lo que SÍ se conserva entero es el nombre accesible de cada control:
          los `aria-label` de abajo siguen diciendo «Duración de la pausa del
          bloque N» y «Unidad de la pausa del bloque N», así que quien navegue
          con lector de pantalla no pierde ni una palabra de contexto. */}

      {/* El dato, en grande: el número manda y la unidad va pegada a él, así
          que «10 segundos» se lee de un vistazo en vez de tener que
          reconstruirse a partir de dos casillas. */}
      <div className="message-interval">
        <input
          type="number"
          min={1}
          className="message-interval__amount nodrag"
          value={item.amount}
          onChange={(event) => {
            const valor = Number(event.target.value);
            // Se acota en la entrada: una pausa de cero o negativa no significa
            // nada, y dejar que se guarde obligaría a limpiarla más adelante.
            onEdit({ amount: Number.isFinite(valor) && valor > 0 ? valor : 1 });
          }}
          aria-label={`Duración de la pausa del bloque ${position}`}
        />

        <UnitPicker
          value={item.unit}
          position={position}
          onChange={(unit) => onEdit({ unit })}
        />
      </div>

      {/* Arrastrar la duración en vez de teclearla. Escribe en el MISMO sitio
          que el campo numérico: no es otro dato ni otro estado. */}
      <input
        type="range"
        min={1}
        max={tope}
        value={item.amount}
        className="message-interval__slider nodrag"
        style={{ "--interval-fill": `${relleno}%` } as React.CSSProperties}
        onChange={(event) => onEdit({ amount: Number(event.target.value) })}
        aria-label={`Ajustar la duración de la pausa del bloque ${position}`}
      />
    </div>
  );
}
