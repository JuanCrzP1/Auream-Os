import type { ServerResponse } from "node:http";
import { sendJson } from "../http/sendJson";
import { toMyTenantsResponse } from "../http/toMyTenantsResponse";
import type { MembershipRepository } from "../../../domains/team/application/MembershipRepository";

/**
 * `GET /me/tenants` — los tenants a los que pertenece el usuario autenticado.
 *
 * No recibe el userId del cliente: viene de la identidad ya verificada.
 */
export async function handleListMyTenantsRequest(
  response: ServerResponse,
  memberships: MembershipRepository,
  userId: string
): Promise<void> {
  const active = await memberships.findActiveByUser(userId);
  sendJson(response, 200, toMyTenantsResponse(userId, active));
}
