import { Handle, Position } from "@xyflow/react";
import { readWaitResponseConfig } from "@contracts/WaitResponseConfig";
import type { ToolCompactProps } from "../ToolUi";
import { describirEspera } from "./summarizeWaitResponse";

/** Lo que se lee cuando el nodo no lleva mensaje propio. */
export const SIN_MENSAJE_PREVIO = "Esperar la respuesta del cliente";

/**
 * Identidad de cada salida del nodo.
 *
 * Son los valores que viajan como `sourceHandle` en la arista y se guardan como
 * `fromOutput` en el snapshot, así que son PARTE DEL DATO, no rótulos: cambiar
 * uno rompería las conexiones ya guardadas. Los textos visibles van aparte, más
 * abajo, y esos sí se pueden reescribir sin consecuencias.
 */
export const SALIDA_RESPUESTA = "respuesta";
export const SALIDA_TIEMPO_AGOTADO = "tiempo-agotado";

/** Reloj de una espera con límite. Mismo trazo que el resto de la iconografía. */
function IconoReloj() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8.5" r="5.5" />
      <path d="M8 5.75v2.75l1.9 1.4" />
    </svg>
  );
}

/** Lazo del infinito: una espera que no caduca. */
function IconoInfinito() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M5.1 5.6a2.9 2.9 0 1 0 0 4.8L10.9 5.6a2.9 2.9 0 1 1 0 4.8z" />
    </svg>
  );
}

/**
 * Una salida del nodo: su mini tarjeta y su handle.
 *
 * DOS CAPAS QUE NO SE MEZCLAN. `.wr-out` sigue siendo, exactamente como antes,
 * el ancla de posición del `Handle` —`position: relative`, con el punto
 * montado a `right: -12px` sobre SU caja— y nada más: no lleva fondo, ni
 * borde, ni padding propio. Todo el aspecto de mini tarjeta vive en
 * `.wr-out__card`, un envoltorio nuevo alrededor del punto y el rótulo. Así el
 * handle no cambia de sitio ni de cálculo por haberle dado una superficie
 * visual a lo que tiene al lado: sigue siendo hijo directo de `.wr-out`, el
 * mismo elemento de siempre, y `.wr-out__card` es un hermano suyo, no un
 * padre.
 *
 * EL HANDLE ES REAL —`Handle` de React Flow— y no un punto dibujado: de él se
 * arrastra una conexión, en él termina, y se mueve con el nodo porque ES parte
 * del nodo.
 *
 * LLEVA LAS MISMAS CLASES QUE EL HANDLE DEL CASCARÓN —`flow-node__handle` y
 * `flow-node__handle--source`, las que pone `FlowNodeCard`—, para que las
 * salidas propias y la genérica compartan el mismo gancho de estilo del
 * Builder.
 */
function Salida({
  id,
  rotulo,
  tono
}: {
  readonly id: string;
  readonly rotulo: string;
  readonly tono: "respuesta" | "tiempo";
}) {
  return (
    <li className={`wr-out wr-out--${tono}`}>
      <span className="wr-out__card">
        <span className="wr-out__dot" aria-hidden="true" />
        <span className="wr-out__label">{rotulo}</span>
      </span>
      <Handle
        type="source"
        id={id}
        position={Position.Right}
        className="flow-node__handle flow-node__handle--source wr-out__handle"
      />
    </li>
  );
}

/**
 * Lo que enseña el nodo «Esperar respuesta» CERRADO, en el lienzo.
 *
 * TRES ZONAS, en el orden en que se leen: qué se pregunta, cuánto se espera y
 * por dónde puede continuar el flujo. La tercera está separada de las otras dos
 * por un filo, porque no es más información sobre la espera: es la frontera del
 * nodo, el sitio del que salen los caminos.
 *
 * LAS SALIDAS SON DOS O UNA, Y LO DECIDE LA CONFIGURACIÓN. Con un tiempo máximo
 * hay dos resultados posibles y los dos se pintan. Con «sin límite» no existe
 * el vencimiento, así que no se ofrece un camino que nunca se podría tomar: se
 * pinta solo «Respuesta». No es una regla nueva —es la misma semántica que ya
 * tiene el contrato— y por eso no hay aquí ningún estado inventado.
 *
 * SOLO PRESENTACIÓN: ni estado, ni manejadores, ni escritura. Recibe el
 * borrador y devuelve marcado; los `Handle` son declarativos y el grafo lo
 * gobierna el lienzo, no este archivo.
 */
export function WaitResponseCompactBody({ draft }: ToolCompactProps) {
  const config = readWaitResponseConfig(draft.config);
  const mensaje = typeof draft.content.text === "string" ? draft.content.text.trim() : "";
  const conLimite = !config.waitIndefinitely && config.timeout !== undefined;

  return (
    <div className="wr-node">
      {/* La pregunta, tal y como la escribió el usuario. Sin ella, el nodo dice
          qué está haciendo en vez de quedarse mudo. */}
      <p className={`wr-node__prompt${mensaje.length === 0 ? " wr-node__prompt--empty" : ""}`}>
        {mensaje.length > 0 ? mensaje : SIN_MENSAJE_PREVIO}
      </p>

      {/* Estado de la espera y, si lo hay, dónde queda la respuesta. Dos datos
          en una fila: el primero en su propia cápsula —ajustada a su contenido,
          no estirada como un campo—, el segundo a continuación y más tenue. */}
      <p className="wr-node__wait">
        <span className="wr-node__chip">
          <span className="wr-node__wait-icon" aria-hidden="true">
            {conLimite ? <IconoReloj /> : <IconoInfinito />}
          </span>
          <span className="wr-node__wait-text">
            {conLimite ? `Máximo: ${describirEspera(config)}` : "Sin límite"}
          </span>
        </span>
        {config.targetKey ? (
          <span className="wr-node__target" title={`Guarda la respuesta en ${config.targetKey}`}>
            ↳ {config.targetKey}
          </span>
        ) : null}
      </p>

      {/* Zona de resultados. El rótulo va en versalitas muy tenues: ordena sin
          competir con el contenido, que es lo que de verdad hay que leer. */}
      <div className="wr-node__outputs">
        <span className="wr-node__outputs-title">
          {conLimite ? "Resultados" : "Resultado"}
        </span>
        <ul className="wr-node__outputs-list">
          <Salida id={SALIDA_RESPUESTA} rotulo="Respuesta" tono="respuesta" />
          {conLimite ? (
            <Salida id={SALIDA_TIEMPO_AGOTADO} rotulo="Tiempo agotado" tono="tiempo" />
          ) : null}
        </ul>
      </div>
    </div>
  );
}
