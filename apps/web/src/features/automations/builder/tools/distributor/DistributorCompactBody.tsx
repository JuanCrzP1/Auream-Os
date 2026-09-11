import "./distributor-editor.css";
import { useEffect } from "react";
import { Handle, Position, useNodeId, useUpdateNodeInternals } from "@xyflow/react";
import type { ToolCompactProps } from "../ToolUi";
import { readDistributorOutputs } from "./readDistributorConfig";
import { describirSalidas } from "./summarizeDistributor";

/**
 * Lo que enseña el nodo «Distribuidor» CERRADO, en el lienzo.
 *
 * LA CONFIGURACIÓN MANDA SOBRE LOS PUNTOS DE CONEXIÓN. No hay ninguna lista de
 * handles escrita a mano: se pinta un `Handle` por cada salida configurada, con
 * el `id` de esa salida. Añadir una salida en el editor crea su punto; borrarla
 * lo retira. No pueden desincronizarse porque no son dos cosas — son la misma
 * lista recorrida una vez.
 *
 * SIN SALIDAS NO HAY PUNTOS, y es deliberado. Un Distribuidor recién traído de
 * la paleta no reparte a ninguna parte todavía; ofrecer un punto de salida
 * invitaría a conectar algo que la configuración no reconoce, y esa arista
 * quedaría apuntando a una salida inexistente.
 *
 * `ownsOutputs: true` en `ui.tsx` es lo que hace posible todo esto: el cascarón
 * se aparta y no pinta su salida única. El handle de ENTRADA lo sigue poniendo
 * él, como en las catorce herramientas.
 *
 * SOLO PRESENTACIÓN: ni estado, ni edición, ni escritura. Recibe el borrador y
 * devuelve marcado.
 */
export function DistributorCompactBody({ draft }: ToolCompactProps) {
  const salidas = readDistributorOutputs(draft.config);

  // AVISAR A REACT FLOW DE QUE LOS PUNTOS HAN CAMBIADO.
  //
  // React Flow mide los handles de un nodo UNA VEZ y guarda sus posiciones. Si
  // aparecen o desaparecen después —y aquí pasa cada vez que se guarda una
  // salida nueva—, esa medición se queda vieja: el punto se ve, pero el lienzo
  // todavía no sabe dónde está, y la conexión que arranca de él nace en la
  // coordenada equivocada. `updateNodeInternals` es la forma que la librería
  // ofrece para decírselo.
  //
  // SE RESUELVE AQUÍ Y NO EN `FlowNodeCard`: el cascarón no sabe cuántas
  // salidas tiene esta herramienta ni cuándo cambian —esa es justamente la
  // frontera que `ownsOutputs` establece—, así que quien monta los puntos es
  // quien avisa de que se han movido.
  //
  // `useNodeId` devuelve `null` fuera de un nodo real del lienzo —montado
  // suelto en una prueba, por ejemplo—: sin id no hay a quién avisar y no se
  // hace nada, en vez de fallar.
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();
  const identidades = salidas.map((salida) => salida.id).join("|");

  useEffect(() => {
    if (nodeId === null) return;
    updateNodeInternals(nodeId);
  }, [nodeId, identidades, updateNodeInternals]);

  if (salidas.length === 0) {
    return (
      <div className="ds-node">
        {/* Estado vacío del nodo: dice lo que HAY —nada— sin pedir nada. La
            acción de crear salidas vive en el editor, no en el lienzo: el nodo
            cerrado es un resumen y no gana un botón por estar vacío. */}
        <p className="ds-node__empty">Sin salidas configuradas</p>
      </div>
    );
  }

  return (
    <div className="ds-node">
      {/* Cuántas son, antes de enumerarlas: con seis salidas, el número se lee
          de un vistazo y la lista se recorre solo si hace falta. Misma frase que
          el resumen de la paleta — una sola forma de contar salidas. */}
      <span className="ds-node__count">{describirSalidas(salidas.length)}</span>

      <ul className="ds-node__list">
        {salidas.map((salida) => (
          /* La FILA es el ancla de posición del punto (`position: relative` en
             la hoja), no una tarjeta: el handle se monta contra ella y por eso
             cada salida tiene el suyo a su propia altura. */
          <li key={salida.id} className="ds-out">
            <span className="ds-out__label">{salida.label}</span>
            {/* EL HANDLE ES REAL —`Handle` de React Flow— y lleva las mismas
                clases que pone `FlowNodeCard`, para que las salidas propias y la
                genérica compartan el gancho de estilo del Builder. Su `id` ES el
                de la salida: eso es lo que guarda la arista en `fromOutput` y lo
                que la devuelve a su punto exacto al recargar el flujo. */}
            <Handle
              type="source"
              id={salida.id}
              position={Position.Right}
              className="flow-node__handle flow-node__handle--source ds-out__handle"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
