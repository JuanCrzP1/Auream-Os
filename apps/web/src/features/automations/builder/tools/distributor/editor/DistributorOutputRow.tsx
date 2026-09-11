import type { DistributorOutput } from "../distributorOutputs";

interface DistributorOutputRowProps {
  readonly output: DistributorOutput;
  readonly onRemove: (id: string) => void;
}

/**
 * Una salida dentro del editor: su nombre y la acción de retirarla.
 *
 * COMPACTA A PROPÓSITO. Una salida es un nombre y un punto por donde sigue la
 * conversación; convertir eso en una tarjeta con secciones haría que seis
 * salidas llenaran el editor de marcos vacíos. La jerarquía es la del producto:
 * primero el nombre, después la acción.
 *
 * NO MUESTRA CANTIDADES. La referencia funcional enseña un reparto por salida,
 * pero en AUREAM eso no existe todavía: ni el motor reparte —
 * `DistributorNodeHandler` declara `distributor_executor_not_implemented`— ni
 * hay contador de conversaciones que leer. Pintar un «0» o un porcentaje sería
 * enseñar un dato inventado, que es justo lo que esta plataforma no hace con las
 * herramientas que aún no ejecutan.
 *
 * SOLO PRESENTACIÓN: recibe una salida y una devolución de llamada. No conoce la
 * lista, ni el borrador, ni cómo se guarda.
 */
export function DistributorOutputRow({ output, onRemove }: DistributorOutputRowProps) {
  return (
    <li className="ds-row">
      <span className="ds-row__label">{output.label}</span>

      <button
        type="button"
        className="ds-row__remove nodrag"
        // El nombre de la salida entra en la etiqueta accesible: con cuatro
        // botones iguales en la lista, «Eliminar» a secas no dice cuál.
        aria-label={`Eliminar ${output.label}`}
        title="Eliminar salida"
        onClick={() => onRemove(output.id)}
      >
        {/* SVG del sistema, no un emoji ni un carácter que lo imite: mismo
            trazo de 1.5 y mismas terminaciones redondeadas que el resto de la
            iconografía del Builder. */}
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
        </svg>
      </button>
    </li>
  );
}
