import { useRef, useState } from "react";
import {
  aceptaHora,
  aceptaMinuto,
  from24Hour,
  horaPuedeCrecer,
  normalizarHora,
  normalizarMinuto,
  to24Hour,
  type Meridiem
} from "../time12";

interface IntervalTimeControlProps {
  /** La hora guardada, `HH:mm` de veinticuatro. Vacía si todavía no hay. */
  readonly value: string;
  /** Nombre del GRUPO: «Hora a la que continuar», «Inicio», «Fin». */
  readonly label: string;
  readonly className?: string;
  /**
   * La hora nueva en `HH:mm`, o CADENA VACÍA si lo que hay está a medias.
   *
   * Publicar el vacío es deliberado y es media arquitectura: si al borrar la
   * hora no dijéramos nada, el borrador se quedaría con la anterior y Guardar
   * escribiría una hora que el usuario ya no ve en pantalla. Vacío significa
   * «aquí ya no hay hora», y quien decide si eso se puede guardar es
   * `validateInterval`.
   */
  readonly onChange: (time: string) => void;
}

/** Las dos mitades del día, en el orden en que se leen. */
const MITADES: ReadonlyArray<{ readonly valor: Meridiem; readonly rotulo: string }> = [
  { valor: "am", rotulo: "a. m." },
  { valor: "pm", rotulo: "p. m." }
];

/**
 * EL CONTROL DE HORA: tres piezas, no una caja de texto.
 *
 *     ┌────┐   ┌────┐   ┌───────┐┌───────┐
 *     │ 02 │ : │ 45 │   │ a. m. ││ p. m. │
 *     └────┘   └────┘   └───────┘└───────┘
 *
 * POR QUÉ NO ES UNA CAJA DE TEXTO, que es lo que fue y de lo que viene el
 * problema. Una caja de texto acepta texto, y «10ndjd» es texto. Se podía
 * validar después y rechazar el guardado, pero eso deja que el estado pase por
 * un valor imposible y convierte el primer aviso que lee la persona en un
 * regaño por algo que el campo nunca debió dejarle escribir. La dirección
 * correcta no era un parser mejor: era MENOS LIBERTAD DE ENTRADA.
 *
 * LA RESTRICCIÓN VIVE EN EL CONTROL. Cada pulsación se contrasta con el dominio
 * —`aceptaHora`, `aceptaMinuto`— ANTES de tocar el estado, así que la que no
 * pertenece sencillamente no entra: la «a» de «10a» se descarta y el campo se
 * queda en «10»; el segundo «9» de «99» no entra; el «0» de «60» tampoco.
 * `validateInterval` sigue ahí como segunda barrera, pero ya no como primera
 * experiencia.
 *
 * LOS DOS PUNTOS NO SON DEL INPUT. Son un elemento aparte, decorativo y
 * permanente: no se teclean, no se borran y no desaparecen mientras se edita.
 * Por eso tampoco hay máscara que inserte o quite nada a media palabra.
 *
 * EL FOCO PASA SOLO DE LA HORA A LOS MINUTOS, en cuanto la hora ya no puede
 * crecer. Quién decide eso es el dominio y no un contador de caracteres
 * —`horaPuedeCrecer`—: «1» espera su segunda cifra porque existen las 10, las
 * 11 y las 12; «2» no la espera porque no hay ninguna hora entre las 20 y las
 * 29, y retener ahí el cursor obligaría a teclear «02» donde «2» ya es
 * inequívoco. De los minutos NO se avanza a ninguna parte: detrás no hay otro
 * campo que rellenar, solo dos botones que se pulsan.
 *
 * EL A. M./P. M. NO SE ESCRIBE: SE PULSA. Dos botones con `aria-pressed`, uno y
 * solo uno activo. Que la mitad del día sea una decisión explícita —y no unas
 * letras al final de una cadena— es lo que elimina de golpe «PM», «p.m.»,
 * «p. m.» y la ambigüedad de las doce.
 *
 * EL BORRADOR LOCAL ES SOLO DE EDICIÓN, Y CADUCA. Mientras se teclea hace falta
 * poder enseñar lo que ninguna hora guardada puede representar —un campo vacío,
 * un «8» sin cero—, y eso vive aquí. Pero lleva grabado CONTRA QUÉ VALOR se
 * escribió (`base`), y en cuanto `value` deja de ser ese, el borrador se tira y
 * manda lo configurado. Esa caducidad es la que impide la divergencia que hubo
 * con la fecha: aquí la pantalla no puede quedarse enseñando algo que el
 * borrador del nodo ya no contiene.
 *
 * SOLO PRESENTACIÓN: no sabe qué es una hora —eso lo dice `time12`— ni qué se
 * puede guardar —eso lo dice `validateInterval`—.
 */
export function IntervalTimeControl({
  value,
  label,
  className,
  onChange
}: IntervalTimeControlProps) {
  // El campo de minutos, para poder mandarle el foco cuando la hora se
  // termina. Es la única razón por la que este componente toca el DOM.
  const minutos = useRef<HTMLInputElement>(null);

  const [borrador, setBorrador] = useState<
    { readonly base: string; readonly hour: string; readonly minute: string; readonly meridiem: Meridiem } | null
  >(null);

  // El borrador solo vale si se escribió contra la hora que hay AHORA. Si el
  // nodo cambió por debajo, lo tecleado ya no describe nada y se descarta.
  const vigente = borrador !== null && borrador.base === value ? borrador : null;
  const leida = from24Hour(value);

  const hour = vigente?.hour ?? leida?.hour ?? "";
  const minute = vigente?.minute ?? leida?.minute ?? "";
  // Sin hora guardada ni nada tecleado, la mañana. Uno de los dos tiene que
  // estar pulsado siempre: «ninguno» no es un estado que este control ofrezca.
  const meridiem = vigente?.meridiem ?? leida?.meridiem ?? "am";

  /**
   * LO ÚLTIMO APLICADO, legible sin esperar a que React vuelva a pintar.
   *
   * Hace falta por el AUTOAVANCE, y costó un fallo descubrirlo: mover el foco
   * dispara el `blur` del campo de hora DENTRO del mismo evento, antes de que
   * haya un render nuevo, así que el manejador de `blur` seguía leyendo el
   * `hour` de la pasada anterior. Al normalizarlo, «12» recién tecleado se
   * reescribía con el «01» de antes. La referencia se actualiza dentro de
   * `aplicar` —es decir, en el acto— y también en cada render, para que valga
   * igual cuando el valor llega desde arriba.
   */
  const ultimo = useRef({ hour, minute, meridiem });
  ultimo.current = { hour, minute, meridiem };

  /**
   * Adopta las tres piezas y publica lo que signifiquen.
   *
   * `base` se apunta a la hora que ESTO produce, no a la que había: así el
   * borrador sigue vivo tras nuestro propio `onChange` —el `value` que vuelve
   * es justo ese— y muere si el valor cambia por cualquier otro camino.
   */
  const aplicar = (siguiente: { hour: string; minute: string; meridiem: Meridiem }) => {
    const time = to24Hour(siguiente.hour, siguiente.minute, siguiente.meridiem) ?? "";

    ultimo.current = siguiente;
    setBorrador({ base: time, ...siguiente });
    if (time !== value) onChange(time);
  };

  /**
   * Rechaza la pulsación dejando el estado como estaba.
   *
   * Reescribe el borrador con lo MISMO que ya había, y ese objeto nuevo es el
   * punto: un `input` controlado solo recupera su valor si React vuelve a
   * pintar, y sin cambio de estado no lo haría — el carácter descartado se
   * quedaría visible en el DOM aunque no estuviera en ningún sitio más.
   */
  const rechazar = () => setBorrador({ base: value, hour, minute, meridiem });

  return (
    <div className={`iv-time${className ? ` ${className}` : ""}`} role="group" aria-label={label}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        className="iv-time__field nodrag"
        aria-label="Hora"
        placeholder="--"
        value={hour}
        onChange={(evento) => {
          const texto = evento.target.value;
          if (!aceptaHora(texto)) return rechazar();

          aplicar({ hour: texto, minute, meridiem });

          // LA HORA ESTÁ TERMINADA: el cursor se va solo a los minutos y
          // selecciona lo que haya, para que escribir encima los reemplace sin
          // tener que borrarlos antes. Nadie tiene que hacer clic.
          if (texto !== "" && !horaPuedeCrecer(texto)) {
            minutos.current?.focus();
            minutos.current?.select();
          }
        }}
        // Al salir, «8» se lee «08». Nunca mientras se teclea.
        onBlur={() =>
          aplicar({ ...ultimo.current, hour: normalizarHora(ultimo.current.hour) })
        }
      />

      {/* FIJO Y DECORATIVO. Ni se escribe ni se borra ni se va. */}
      <span className="iv-time__colon" aria-hidden="true">
        :
      </span>

      <input
        ref={minutos}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        className="iv-time__field nodrag"
        aria-label="Minutos"
        placeholder="--"
        value={minute}
        onChange={(evento) => {
          const texto = evento.target.value;
          if (!aceptaMinuto(texto)) return rechazar();

          aplicar({ hour, minute: texto, meridiem });
        }}
        onBlur={() =>
          aplicar({ ...ultimo.current, minute: normalizarMinuto(ultimo.current.minute) })
        }
      />

      <div className="iv-time__meridiem">
        {MITADES.map(({ valor, rotulo }) => (
          <button
            key={valor}
            type="button"
            // `aria-pressed` y no `role="radio"`: son dos botones de alternancia
            // sobre un dato que SIEMPRE tiene valor, no una lista de la que
            // elegir uno por primera vez.
            aria-pressed={meridiem === valor}
            className={`iv-time__half nodrag${meridiem === valor ? " iv-time__half--on" : ""}`}
            // Cambiar de mitad del día NO toca la hora ni los minutos: viajan
            // tal cual y solo se recalcula lo guardado.
            onClick={() => aplicar({ hour, minute, meridiem: valor })}
          >
            {rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
