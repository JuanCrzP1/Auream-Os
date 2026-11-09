import type { ConnectionStatus } from "@contracts/ConnectionContracts";

// Qué se puede hacer con una conexión según su estado (como el menú de Leona).
// Puro: la tarjeta pinta lo que esto decide.

export type ConnectionAction = "link" | "restart" | "disconnect" | "triggers" | "rename" | "delete";

export interface ConnectionMenuItem {
  readonly action: ConnectionAction;
  readonly label: string;
  /** `warning`: corta el servicio pero se puede deshacer; `danger`: no se deshace. */
  readonly tone?: "warning" | "danger";
  /** Separada de las anteriores en el menú. */
  readonly separated?: boolean;
}

const LINK_LABEL: Readonly<Record<ConnectionStatus, string>> = {
  pending: "Vincular número",
  connecting: "Ver código QR",
  disconnected: "Reconectar",
  connected: "Ver estado"
};

export function connectionMenu(status: ConnectionStatus): ReadonlyArray<ConnectionMenuItem> {
  return [
    { action: "link", label: LINK_LABEL[status] },
    ...(status === "connected" ? [{ action: "restart" as const, label: "Reiniciar conexión" }] : []),
    ...(status === "connected" || status === "connecting" ? [{ action: "disconnect" as const, label: "Desconectar", tone: "warning" as const }] : []),
    { action: "triggers", label: "Disparadores", separated: true },
    { action: "rename", label: "Renombrar" },
    { action: "delete", label: "Eliminar", tone: "danger", separated: true }
  ];
}
