import type { ConnectionSummary } from "@contracts/ConnectionContracts";

/** Por la API oficial se escribe primero solo con plantillas aprobadas (pronto). */
export const canBroadcast = (connection: ConnectionSummary) => connection.method === "qr" && connection.status === "connected";

export function whyNot(connection: ConnectionSummary): string | null {
  if (connection.method !== "qr") return "API oficial: necesita plantillas aprobadas por Meta (pronto)";
  if (connection.status !== "connected") return "No está conectado";
  return null;
}
