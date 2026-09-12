import type { IntervalTrigger } from "@contracts/IntervalConfig";
import { IconoEspera, IconoFecha } from "../intervalModeIcons";

interface Opcion {
  readonly trigger: IntervalTrigger;
  /** Lo que se lee en la pestaña. Corto: caben dos en una fila de 264px+. */
  readonly rotulo: string;
  /** El nombre completo, para quien no ve la fila entera. */
  readonly nombre: string;
  readonly Icono: () => JSX.Element;
}

/**
 * Los dos momentos principales, con su nombre en el idioma del producto.
 *
 * Vive aquí y no en el contrato porque son RÓTULOS: el contrato guarda
 * `"interval" | "date"` —que es dato y viaja al motor— y esto es cómo se llaman
 * en pantalla, que puede reescribirse sin consecuencias.
 *
 * DOS TEXTOS POR OPCIÓN, y no es redundancia. En la pestaña cabe una palabra; el
 * nombre entero va al `aria-label`, porque «Fecha» a secas no le dice a un
 * lector de pantalla lo mismo que «En una fecha» — y quien navega a ciegas no
 * tiene el icono ni la fila para deducirlo.
 */
const OPCIONES: ReadonlyArray<Opcion> = [
  {
    trigger: "interval",
    rotulo: "Después",
    nombre: "Después de un tiempo",
    Icono: IconoEspera
  },
  {
    trigger: "date",
    rotulo: "Fecha",
    nombre: "En una fecha",
    Icono: IconoFecha
  }
];

interface IntervalTriggerPickerProps {
  readonly value: IntervalTrigger;
  readonly onChange: (trigger: IntervalTrigger) => void;
}

/**
 * QUÉ decide cuándo continúa la conversación: una espera o una cita.
 *
 * SON DOS Y SON EXCLUYENTES, y la fila lo dice sin explicarlo: elegir una apaga
 * la otra porque no hay forma de tener las dos. El horario NO está en esta fila
 * —vive debajo, como un interruptor— justamente porque no compite con ninguna
 * de las dos: se suma a la que se elija. Cuando eran tres pestañas iguales, la
 * interfaz afirmaba una exclusividad que el dominio no tiene.
 *
 * SON PESTAÑAS DE UNA MISMA PIEZA, no dos tarjetas sueltas. La activa comparte
 * fondo con el panel de abajo y pierde su filo inferior, así que se lee como la
 * sección ABIERTA de un archivo y no como un botón encendido; la otra queda
 * hundida, visible pero sin competir. Todo eso lo hace la hoja: aquí solo se
 * declara cuál está activa.
 *
 * ES UN GRUPO DE RADIO DE VERDAD —`role="radiogroup"` con `aria-checked`—, no
 * dos botones que se pintan distinto: para quien navega con teclado o lector de
 * pantalla, esto es una elección entre dos excluyentes.
 *
 * SOLO PRESENTACIÓN: recibe el momento activo y una devolución de llamada. No
 * sabe qué configuración hay detrás de cada uno ni qué pasa al cambiar.
 */
export function IntervalTriggerPicker({ value, onChange }: IntervalTriggerPickerProps) {
  return (
    <div className="iv-tabs" role="radiogroup" aria-label="Cuándo debe continuar">
      {OPCIONES.map(({ trigger, rotulo, nombre, Icono }) => (
        <button
          key={trigger}
          type="button"
          role="radio"
          aria-checked={value === trigger}
          aria-label={nombre}
          className={`iv-tab nodrag${value === trigger ? " iv-tab--on" : ""}`}
          onClick={() => onChange(trigger)}
        >
          <span className="iv-tab__icon" aria-hidden="true">
            <Icono />
          </span>
          <span className="iv-tab__label">{rotulo}</span>
        </button>
      ))}
    </div>
  );
}
