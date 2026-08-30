import type { IncomingMessage, ServerResponse } from "node:http";
import { handleListMyTenantsRequest } from "../handlers/handleListMyTenantsRequest";
import { handleOnboardingRequest } from "../handlers/handleOnboardingRequest";
import type { MembershipRepository } from "../../../domains/team/application/MembershipRepository";
import type { OnboardingPort } from "../../../domains/team/application/OnboardingPort";
import type { AuthenticatedPrincipal } from "../../../platform/identity/contracts/AuthenticatedPrincipal";

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
}

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
    await handleOnboardingRequest(response, services.onboarding, userId, "Mi espacio");
    return true;
  }

  return false;
}
