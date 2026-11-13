import type { ContactFieldType } from "@contracts/ContactFieldContracts";
import { typeLabel } from "../fieldText";

/** El tipo de un campo, con su color (lista lila, fecha verde azulado, número ámbar, sí o no verde, texto gris). */
export function TypeChip({ type, options }: { readonly type: ContactFieldType; readonly options?: ReadonlyArray<string> }) {
  return <span className={`cf-type cf-type--${type}`}>{typeLabel(type, options)}</span>;
}
