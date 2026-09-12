import "./interval-editor.css";
import { readIntervalConfig } from "@contracts/IntervalConfig";
import type { ToolCompactProps } from "../ToolUi";
import { describirMomento } from "./summarizeInterval";
import { ICONO_DE_TRIGGER } from "./intervalModeIcons";

/** Qué CLASE de espera es. Un mapa, no un `if`. */
const MOMENTOS = {
  interval: "Intervalo",
  date: "Fecha"
} as const;

/**
 * Lo que enseña el nodo «Programador» CERRADO, en el lienzo.
 *
 * NO ES UNA TARJETA DENTRO DE OTRA. Las otras herramientas resumen dentro de
 * una superficie propia —Esperar respuesta con sus dos resultados, Distribuidor
 * con sus salidas—; aquí no hay ninguna: el contenido se apoya directamente
 * sobre el cuerpo del nodo y lo que lo organiza es una LÍNEA TEMPORAL dibujada
 * al margen. Esa línea es la firma de la herramienta y lo que la hace
 * reconocible de lejos sin leer una palabra.
 *
 * LA LÍNEA SE LEE DE ARRIBA ABAJO, que es como pasa el tiempo: el punto es
 * «ahora», el trazo es lo que se espera y el codo del final entrega la
 * conversación al bloque siguiente. Tres marcas, ningún adorno — quita
 * cualquiera de las tres y la composición deja de contar algo.
 *
 * LA DIBUJA LA HOJA, NO EL DOM. Punto, trazo y codo son pseudo-elementos: no
 * son contenido, no se leen en voz alta y no ensucian el marcado con divs
 * vacíos. Lo único que hay aquí son las tres cosas que SÍ se leen —la clase de
 * espera, el valor y hacia dónde sigue—.
 *
 * EL MISMO SISTEMA PARA LOS DOS MOMENTOS. Cambia el signo y cambia el valor; la
 * línea permanece. Lo que el usuario aprende mirando un Programador le sirve
 * para el otro.
 *
 * EL HORARIO NO ES UN TERCER CASO: es una coletilla en la línea de versalitas,
 * y esa jerarquía tipográfica es el modelo. Lo que gobierna —la espera o la
 * cita— ocupa el renglón grande; la restricción, si la hay, se clasifica arriba
 * junto a la clase de espera, porque no sustituye al valor sino que lo acota.
 *
 * LA FRASE NO SE ESCRIBE AQUÍ. Sale de `describirMomento`, la misma lectura de
 * la que sale el resumen de la paleta, así que el nodo y el resto del producto
 * no pueden contar cosas distintas del mismo dato.
 *
 * SOLO PRESENTACIÓN: ni estado, ni manejadores, ni escritura.
 */
export function IntervalCompactBody({ draft }: ToolCompactProps) {
  const config = readIntervalConfig(draft.config);
  const Icono = ICONO_DE_TRIGGER[config.trigger];

  return (
    <div className="iv-node">
      <span className="iv-node__mode">
        {MOMENTOS[config.trigger]}
        {config.scheduleEnabled ? " · en horario" : null}
      </span>

      <p className="iv-node__detail">
        <span className="iv-node__glyph" aria-hidden="true">
          <Icono />
        </span>
        {describirMomento(config)}
      </p>

      {/* Hacia dónde sigue. En minúscula y muy tenue a propósito: no es un
          dato configurable ni un estado —es el cierre de la línea, la parte
          que dice que después de esperar la conversación continúa—. */}
      <span className="iv-node__next">continúa el flujo</span>
    </div>
  );
}
