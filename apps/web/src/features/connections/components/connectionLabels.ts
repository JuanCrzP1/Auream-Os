import type { ConnectionMethod, ConnectionStatus } from "@contracts/ConnectionContracts";

// Textos de estados y métodos: una sola fuente para tarjetas, resumen y diálogos.

export const STATUS_LABEL: Readonly<Record<ConnectionStatus, string>> = {
  connected: "Conectada",
  connecting: "Esperando escaneo",
  pending: "Sin vincular",
  disconnected: "Desconectada"
};

export const STATUS_HINT: Readonly<Record<ConnectionStatus, string>> = {
  connected: "Envía y recibe mensajes.",
  connecting: "Escanea el código desde WhatsApp para terminar.",
  pending: "Vincula un número para empezar a usarla.",
  disconnected: "La sesión se cerró: vuelve a vincular el número."
};

export const METHOD_LABEL: Readonly<Record<ConnectionMethod, string>> = {
  qr: "Código QR",
  cloud_api: "API oficial"
};

/** Acción principal según el estado. `null` = no hace falta ninguna. */
export function primaryAction(status: ConnectionStatus): string | null {
  if (status === "connected") return null;
  if (status === "disconnected") return "Reconectar";
  if (status === "connecting") return "Ver código";
  return "Vincular número";
}
