import type { MessageItemKind } from "../types";
import { MESSAGE_ITEM_KINDS } from "../messageItems";

// ---------------------------------------------------------------------------
// Qué se arrastra en el constructor: un tipo NUEVO desde la biblioteca o un
// bloque existente que se MUEVE. Tipos MIME propios para distinguirlos y para
// que el `drop` del lienzo (que lee `application/reactflow`) no cree un nodo.
// ---------------------------------------------------------------------------

const KIND_MIME = "application/auream-message-kind";
const REORDER_MIME = "application/auream-message-item";

export function setKindPayload(transfer: DataTransfer, kind: MessageItemKind): void {
  transfer.setData(KIND_MIME, kind);
  transfer.effectAllowed = "copy";
}

export function setReorderPayload(transfer: DataTransfer, itemId: string): void {
  transfer.setData(REORDER_MIME, itemId);
  transfer.effectAllowed = "move";
}

export function readKindPayload(transfer: DataTransfer): MessageItemKind | null {
  const value = transfer.getData(KIND_MIME);
  return (MESSAGE_ITEM_KINDS as ReadonlyArray<string>).includes(value) ? (value as MessageItemKind) : null;
}

export function readReorderPayload(transfer: DataTransfer): string | null {
  const value = transfer.getData(REORDER_MIME);
  return value.length > 0 ? value : null;
}
