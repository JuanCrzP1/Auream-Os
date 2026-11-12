import type { SimulatorStore } from "../core/SimulatorStore";
import type { SimInstance } from "../core/types";
import { sendJson, type RouteContext } from "../http/http";

// Como uazapi: el token de la instancia en la cabecera `token`; el de
// administración, en `admintoken`. Sin token válido, 401 (Auream lo traduce
// a «uazapi rechazó la credencial»).

export function instanceOf(store: SimulatorStore, context: RouteContext): SimInstance | null {
  const token = context.request.headers["token"];
  const instance = typeof token === "string" ? store.instanceByToken(token) : null;
  if (!instance) sendJson(context.response, 401, { error: "Invalid token" });
  return instance;
}

export function isAdmin(context: RouteContext, adminToken: string): boolean {
  if (context.request.headers["admintoken"] === adminToken) return true;
  sendJson(context.response, 401, { error: "Invalid admin token" });
  return false;
}

/** Para enviar, el número tiene que estar conectado (uazapi responde 503 si no). */
export function requireConnected(instance: SimInstance, context: RouteContext): boolean {
  if (instance.status === "connected") return true;
  sendJson(context.response, 503, { error: "WhatsApp disconnected" });
  return false;
}
