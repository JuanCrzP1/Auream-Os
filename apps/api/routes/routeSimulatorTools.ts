import type { IncomingMessage, ServerResponse } from "node:http";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// Herramientas del WhatsApp simulado (SOLO desarrollo, `apps/wa-sim`).
//
//   POST /dev/simulator/advance   { connectionId, token, phone }
//        «Adelantar el tiempo»: lo que el flujo de ese chat esperaba
//        (Programador, «Tiempo agotado», pausas) corre ya.
//
// Solo existe si la API usa el simulador (`WHATSAPP_SIMULATOR_URL`, que la
// configuración rechaza en producción). No hay sesión de usuario: lo autoriza
// el token del número, igual que un aviso de uazapi, y solo toca chats de ese
// número.
// ---------------------------------------------------------------------------

export const SIMULATOR_ADVANCE_PATH = "/dev/simulator/advance";

export interface SimulatorTools {
  /** La cuenta del número si `token` es su credencial; `null` si no. */
  authenticate(connectionId: string, token: string): Promise<{ readonly tenantId: string } | null>;
  /** Adelanta lo pendiente del chat. Devuelve cuándo iba a vencer. */
  advanceChat(tenantId: string, connectionId: string, phone: string): Promise<Date[]>;
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function routeSimulatorTools(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  tools: SimulatorTools | undefined
): Promise<boolean> {
  if (!tools || url.pathname !== SIMULATOR_ADVANCE_PATH) return false;
  if (request.method !== "POST") {
    sendJson(response, 405, { message: "Method not allowed" });
    return true;
  }
  const body = await parseJsonBody<Record<string, unknown>>(request);
  const connectionId = text(body["connectionId"]);
  const phone = text(body["phone"]).replace(/\D/g, "");
  const connection = connectionId && phone ? await tools.authenticate(connectionId, text(body["token"])) : null;
  if (!connection) {
    sendJson(response, 401, { message: "Número del simulador no reconocido." });
    return true;
  }
  const advanced = await tools.advanceChat(connection.tenantId, connectionId, phone);
  sendJson(response, 200, { advanced: advanced.map((date) => date.toISOString()) });
  return true;
}
