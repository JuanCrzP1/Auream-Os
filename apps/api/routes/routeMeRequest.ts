import type { IncomingMessage, ServerResponse } from "node:http";
import { handleListMyTenantsRequest } from "../handlers/handleListMyTenantsRequest";
import { handleOnboardingRequest } from "../handlers/handleOnboardingRequest";
import type { MembershipRepository } from "../../../domains/team/application/MembershipRepository";
import type { OnboardingPort } from "../../../domains/team/application/OnboardingPort";
import type { AuthenticatedPrincipal } from "../../../platform/identity/contracts/AuthenticatedPrincipal";
import type { ProfileServices } from "../../../domains/profiles/application/ProfileServices";
import type { InvitationServices } from "../../../domains/team/application/InvitationServices";
import { sendJson } from "../http/sendJson";
import { routeMyProfileRequest } from "./routeMyProfileRequest";

// ---------------------------------------------------------------------------
// routeMeRequest
//
// Responsabilidad única: enrutar lo relativo al USUARIO autenticado.
//
// Estas rutas son especiales: se resuelven ANTES de seleccionar tenant, porque
// son justamente las que permiten descubrirlo o crearlo. Sólo necesitan una
// identidad válida.
//
// Precisamente por saltarse la validación de tenant, están restringidas a
// principals de tipo `user`. Una credencial de máquina ya trae su tenant en la
// propia credencial: dejarla entrar aquí le permitiría crear tenants nuevos a
// nombre de su `actorId` y listar memberships que no le corresponden. Hoy no
// hay claves de máquina en producción, pero la restricción tiene que existir
// antes de que las haya.
// ---------------------------------------------------------------------------

export interface MeServices {
  readonly membershipRepository: MembershipRepository;
  readonly onboarding: OnboardingPort;
  /** Mi perfil (`/me/profile`). Ausente: la ruta responde 503. */
  readonly profiles?: ProfileServices;
  /** Aceptar invitaciones al equipo (`/me/invitations/:token/accept`). */
  readonly invitations?: InvitationServices;
}

/** Aceptar una invitación: con sesión pero sin cuenta elegida, porque es justo como se entra a una. */
const ACCEPT_INVITATION = /^\/me\/invitations\/([A-Za-z0-9_-]{1,100})\/accept$/;

export async function routeMeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: MeServices,
  principal: AuthenticatedPrincipal
): Promise<boolean> {
  if (principal.kind !== "user") {
    return false;
  }

  const userId = principal.identity.actorId;

  if (url.pathname === "/me/tenants" && request.method === "GET") {
    await handleListMyTenantsRequest(response, services.membershipRepository, userId);
    return true;
  }

  if (url.pathname === "/me/onboarding" && request.method === "POST") {
    await recordIdentity(services.profiles, userId, principal.identity);
    await handleOnboardingRequest(response, services.onboarding, userId, "Mi espacio");
    return true;
  }

  const invitation = request.method === "POST" ? ACCEPT_INVITATION.exec(url.pathname) : null;
  if (invitation) {
    if (!services.invitations) {
      sendJson(response, 503, { message: "Las invitaciones no están disponibles en este servidor." });
      return true;
    }
    sendJson(response, 200, await services.invitations.accept(invitation[1]!, { userId, ...(principal.identity.email ? { email: principal.identity.email } : {}) }));
    return true;
  }

  return routeMyProfileRequest(request, response, url, services.profiles, userId);
}

/**
 * Copia del token firmado el correo (y el nombre, si falta) al perfil, para
 * que su equipo vea a la persona. Se llama cada vez que la app arranca
 * (`/me/onboarding`); si falla, se reintenta la próxima vez: nunca impide entrar.
 */
async function recordIdentity(profiles: ProfileServices | undefined, userId: string, identity: { readonly email?: string; readonly name?: string }): Promise<void> {
  if (!profiles || !identity.email) return;
  try {
    await profiles.recordIdentity(userId, { email: identity.email, ...(identity.name ? { name: identity.name } : {}) });
  } catch {
    // Sin consecuencias para entrar: el equipo verá el correo cuando vuelva a abrir la app.
  }
}
