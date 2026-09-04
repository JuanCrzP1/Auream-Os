import type { MessageItemKind } from "../types";
import { MESSAGE_ITEM_KINDS } from "../messageItems";

// ---------------------------------------------------------------------------
// Qué se está arrastrando dentro del constructor de Mensaje.
//
// Dos gestos distintos comparten el mismo mecanismo del navegador: traer un
// tipo NUEVO desde la biblioteca, y MOVER uno que ya está en la secuencia. El
// destino tiene que poder distinguirlos, y por eso viajan con tipos MIME
// propios en lugar de con una cadena que haya que interpretar.
//
// El tipo MIME importa por una razón concreta: el lienzo escucha `drop` para
// crear nodos y lee `application/reactflow`. Al usar otro tipo, un contenido
// soltado fuera del constructor no crea un nodo suelto en el lienzo — y el
// constructor detiene la propagación para que no llegue siquiera.
// ---------------------------------------------------------------------------

const KIND_MIME = "application/aureum-message-kind";
const REORDER_MIME = "application/aureum-message-item";

/** Empieza a arrastrar un tipo desde la biblioteca. */
export function setKindPayload(transfer: DataTransfer, kind: MessageItemKind): void {
  transfer.setData(KIND_MIME, kind);
  transfer.effectAllowed = "copy";
}

/** Empieza a arrastrar un contenido ya colocado, para moverlo. */
export function setReorderPayload(transfer: DataTransfer, itemId: string): void {
  transfer.setData(REORDER_MIME, itemId);
  transfer.effectAllowed = "move";
}

/** Tipo traído desde la biblioteca, o `null` si lo que se arrastra es otra cosa. */
export function readKindPayload(transfer: DataTransfer): MessageItemKind | null {
  const value = transfer.getData(KIND_MIME);
  return (MESSAGE_ITEM_KINDS as ReadonlyArray<string>).includes(value)
    ? (value as MessageItemKind)
    : null;
}

/** Id del contenido que se está moviendo, o `null`. */
export function readReorderPayload(transfer: DataTransfer): string | null {
  const value = transfer.getData(REORDER_MIME);
  return value.length > 0 ? value : null;
}
