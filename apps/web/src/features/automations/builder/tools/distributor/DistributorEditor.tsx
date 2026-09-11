import "./distributor-editor.css";
import type { ToolEditorProps } from "../ToolUi";
import {
  anadirSalida,
  quitarSalida,
  type DistributorOutput
} from "./distributorOutputs";
import { readDistributorOutputs } from "./readDistributorConfig";
import { DistributorOutputRow } from "./editor/DistributorOutputRow";

/**
 * Configuración de un «Distribuidor».
 *
 * Recibe el borrador y una devolución de llamada; no conoce el nodo, ni el
 * lienzo, ni React Flow, ni el snapshot, ni la persistencia. El contrato
 * `ToolEditorProps` no le da con qué hacer otra cosa, y por eso un editor no
 * puede convertirse en un mini-builder por muy rica que llegue a ser su
 * configuración.
 *
 * SIN ESTADO PROPIO. Las salidas se leen en cada render desde `draft.config`.
 * Con una copia en `useState` habría dos verdades sobre la misma lista —la del
 * editor y la del nodo— y bastaría con cancelar, cerrar y reabrir para que
 * divergieran. El borrador acumulado vive en `NodeExpandedFrame`, que es el
 * único dueño de «lo editado y no confirmado»; Guardar y Cancelar son suyos y
 * aquí no se reimplementan.
 *
 * NO IMPORTA NADA DE MENSAJE NI DE ESPERAR RESPUESTA. Ni sus editores, ni sus
 * controles, ni sus hojas: son herramientas independientes y lo único que
 * comparten es el marco genérico que las contiene y el contrato que implementan.
 */
export function DistributorEditor({ draft, onChange }: ToolEditorProps) {
  const salidas = readDistributorOutputs(draft.config);

  /**
   * Publica una lista de salidas nueva conservando el resto del borrador.
   *
   * `outputs` se aparta del volcado para que la lista que se emite sea la única
   * que queda: `applyNodePatch` reemplaza el objeto entero, así que volcar
   * `...draft.config` encima devolvería la lista vieja. Lo que queda en `resto`
   * es lo que otra versión hubiera guardado y esta no conoce; eso sí se conserva
   * íntegro.
   */
  const publicar = (outputs: ReadonlyArray<DistributorOutput>) => {
    const { outputs: _viejas, ...resto } = draft.config;

    onChange({ config: { ...resto, outputs } });
  };

  return (
    <div className="distributor">
      {/* LAS SALIDAS. Es lo único que esta herramienta configura hoy, así que
          es lo primero y ocupa el editor entero en vez de esconderse bajo una
          sección de ajustes que no existe. */}
      <section className="distributor__section">
        <h3 className="distributor__label">Salidas</h3>
        <p className="distributor__hint">
          Cada salida es un camino por el que puede seguir la conversación.
        </p>

        {salidas.length === 0 ? (
          /* ESTADO VACÍO DE VERDAD: no se pinta una «Salida 1» de cortesía que
             el usuario no creó. Lo que hay es la frase de que no hay nada y el
             botón de crear la primera, y con eso el editor se lee terminado. */
          <p className="distributor__empty">No hay salidas configuradas todavía.</p>
        ) : (
          <ul className="distributor__list">
            {salidas.map((salida) => (
              <DistributorOutputRow
                key={salida.id}
                output={salida}
                onRemove={(id) => publicar(quitarSalida(salidas, id))}
              />
            ))}
          </ul>
        )}

        <button
          type="button"
          className="distributor__add nodrag"
          onClick={() => publicar(anadirSalida(salidas))}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M8 3.75v8.5M3.75 8h8.5" />
          </svg>
          Añadir salida
        </button>
      </section>

      <hr className="distributor__rule" />

      {/* CÓMO FUNCIONA. Breve, humano y HONESTO: esta herramienta todavía no
          reparte en ejecución —su handler lo declara— y decirlo aquí es más
          útil que dejar que alguien lo descubra publicando el flujo. Mismo
          criterio que el resto de la plataforma con lo que aún no ejecuta. */}
      <section className="distributor__section">
        <h3 className="distributor__label">Cómo funciona</h3>
        <p className="distributor__hint">
          Conecta cada salida con el bloque que quieras desde el punto que
          aparece a su derecha en el lienzo. Al eliminar una salida también
          desaparece su punto y las conexiones que salían de él.
        </p>
        <p className="distributor__hint">
          El reparto automático entre salidas todavía no está disponible: por
          ahora puedes dejar los caminos preparados.
        </p>
      </section>
    </div>
  );
}
