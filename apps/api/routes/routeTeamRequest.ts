import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { TeamPermissions } from "../../../platform/authorization/permissions/TeamPermissions";
import type { ChangeMemberRoleRequest, CreateInvitationRequest } from "../../../contracts/TeamContracts";
import type { TeamServices } from "../../../domains/team/application/TeamServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// `/team` — el equipo de la cuenta activa (Configuración → Equipo).
//
//   GET    /team                              ver miembros e invitaciones  (team.read)
//   POST   /team/invitations                  invitar con enlace           (team.manage)
//   POST   /team/invitations/:id/renew        enlace nuevo                 (team.manage)
//   DELETE /team/invitations/:id              cancelar la invitación       (team.manage)
//   PATCH  /team/members/:userId              cambiar el rol               (team.manage)
//   DELETE /team/members/:userId              quitar del equipo            (team.manage)
//
// A quién puede tocar cada uno lo decide `TeamPolicy` en el dominio. Solo
// personas (sesión), nunca credenciales de máquina. La cuenta y el usuario
// salen SIEMPRE del contexto verificado.
// ---------------------------------------------------------------------------

function noContent(response: ServerResponse): void {
  response.statusCode = 204;
  response.end();
}

const INVITATION = /^\/team\/invitations\/([0-9a-f-]{36})(\/renew)?$/i;
const MEMBER = /^\/team\/members\/([0-9a-f-]{36})$/i;

export async function routeTeamRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  team: TeamServices | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/team" && !path.startsWith("/team/")) return false;
  const method = request.method ?? "GET";
  if (!team) {
    sendJson(response, 503, { message: "El equipo no está disponible en este servidor." });
    return true;
  }
  if (context.authMethod !== "jwt") {
    sendJson(response, 403, { message: "El equipo solo lo administran personas." });
    return true;
  }
  const actor = { tenantId: context.tenantId, userId: context.actorId };

  if (path === "/team" && method === "GET") {
    requireScope(context, TeamPermissions.read, context.tenantId);
    sendJson(response, 200, await team.list(actor));
    return true;
  }

  requireScope(context, TeamPermissions.manage, context.tenantId);

  if (path === "/team/invitations" && method === "POST") {
    sendJson(response, 201, await team.invite(actor, await parseJsonBody<Partial<CreateInvitationRequest>>(request)));
    return true;
  }

  const invitation = INVITATION.exec(path);
  if (invitation?.[2] && method === "POST") {
    sendJson(response, 200, await team.renew(actor, invitation[1]!));
    return true;
  }
  if (invitation && !invitation[2] && method === "DELETE") {
    await team.revoke(actor, invitation[1]!);
    noContent(response);
    return true;
  }

  const member = MEMBER.exec(path);
  if (member && method === "PATCH") {
    sendJson(response, 200, await team.changeRole(actor, member[1]!, await parseJsonBody<Partial<ChangeMemberRoleRequest>>(request)));
    return true;
  }
  if (member && method === "DELETE") {
    await team.remove(actor, member[1]!);
    noContent(response);
    return true;
  }

  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
