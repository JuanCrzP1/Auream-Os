import { InlineInput, RemoveButton } from "../../_kit/fields";
import type { DistributorOutput } from "../distributorOutputs";

interface DistributorOutputRowProps {
  readonly output: DistributorOutput;
  /** Nombre tal como está guardado (puede estar vacío mientras se escribe). */
  readonly label: string;
  readonly index: number;
  readonly onRename: (label: string) => void;
  readonly onRemove: (id: string) => void;
}

/**
 * Una salida: su turno en el reparto, su nombre editable y quitarla. Sin
 * cantidades ni porcentajes: el motor todavía no reparte.
 */
export function DistributorOutputRow({ output, label, index, onRename, onRemove }: DistributorOutputRowProps) {
  return (
    <li className="ds-row">
      <span className="ds-row__turn" aria-hidden="true">
        {index + 1}
      </span>
      <InlineInput
        value={label}
        placeholder={`Salida ${index + 1}`}
        ariaLabel={`Nombre de la salida ${index + 1}`}
        maxLength={40}
        onChange={onRename}
      />
      <span className="ds-row__remove">
        <RemoveButton label={`Eliminar ${output.label}`} onClick={() => onRemove(output.id)} />
      </span>
    </li>
  );
}
