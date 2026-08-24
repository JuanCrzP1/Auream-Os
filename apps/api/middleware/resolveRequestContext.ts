import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { AuthenticatedPrincipal } from "../../../platform/identity/contracts/AuthenticatedPrincipal";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import type { MembershipRepository } from "../../../domains/team/application/MembershipRepository";
import { ROLE_SCOPES } from "../../../platform/authorization/roles/RoleDefinitions";

// ---------------------------------------------------------------------------
// resolveRequestContext
//
// Responsabilidad única: responder "¿en qué tenant estás y qué puedes hacer?".
//
// Para un usuario, el tenant se resuelve así:
//   1. `X-Tenant-Id` es una SELECCIÓN del cliente, jamás una afirmación.
//   2. Se valida contra una membership ACTIVA en base de datos.
//   3. Los scopes se derivan del rol de esa membership vía ROLE_SCOPES.
//
// Por eso un cliente no puede escalar privilegios: aunque manipule la cabecera
// o inyecte claims en el token, los scopes salen de la base, no de la petición.
//
// Para una máquina (API key), el tenant y los scopes ya vienen en la credencial.
// ---------------------------------------------------------------------------

export type ContextResolution =
  | { readonly outcome: "resolved"; readonly context: RequestContext }
  /** Autenticado, pero sin acceso al tenant pedido → 403. */
  | { readonly outcome: "forbidden"; readonly reason: string }
  /** Pertenece a varios tenants y no eligió ninguno → 400. */
  | { readonly outcome: "tenant_required"; readonly reason: string };

const TENANT_HEADER = "x-tenant-id";

export async function resolveRequestContext(
  request: IncomingMessage,
  principal: AuthenticatedPrincipal,
  memberships: MembershipRepository
): Promise<ContextResolution> {
  const requestId = randomUUID();

  if (principal.kind === "machine") {
    const { tenantId, actorId, scopes } = principal.identity;
    return {
      outcome: "resolved",
      context: { tenantId, actorId, authMethod: "api_key", requestId, scopes }
    };
  }

  const userId = principal.identity.actorId;
  const selected = readSelectedTenant(request);

  if (selected) {
    const membership = await memberships.findActive(userId, selected);

    if (!membership) {
      return { outcome: "forbidden", reason: "No membership for the selected tenant" };
    }

    return {
      outcome: "resolved",
      context: {
        tenantId: membership.tenantId,
        actorId: userId,
        authMethod: "jwt",
        requestId,
        scopes: ROLE_SCOPES[membership.role]
      }
    };
  }

  // Sin selección explícita: sólo se resuelve solo si no hay ambigüedad.
  const active = await memberships.findActiveByUser(userId);

  if (active.length === 0) {
    return { outcome: "forbidden", reason: "User has no active membership" };
  }

  if (active.length > 1) {
    return { outcome: "tenant_required", reason: "Multiple tenants available; select one" };
  }

  const only = active[0]!.membership;

  return {
    outcome: "resolved",
    context: {
      tenantId: only.tenantId,
      actorId: userId,
      authMethod: "jwt",
      requestId,
      scopes: ROLE_SCOPES[only.role]
    }
  };
}

function readSelectedTenant(request: IncomingMessage): string | null {
  const header = request.headers[TENANT_HEADER];
  const value = Array.isArray(header) ? header[0] : header;

  return typeof value === "string" && value.length > 0 ? value : null;
}
