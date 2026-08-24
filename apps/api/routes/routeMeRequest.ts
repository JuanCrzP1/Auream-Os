import type { IncomingMessage, ServerResponse } from "node:http";
import { handleListMyTenantsRequest } from "../handlers/handleListMyTenantsRequest";
import { handleOnboardingRequest } from "../handlers/handleOnboardingRequest";
import type { MembershipRepository } from "../../../domains/team/application/MembershipRepository";
import type { OnboardingPort } from "../../../domains/team/application/OnboardingPort";

// ---------------------------------------------------------------------------
// routeMeRequest
//
// Responsabilidad única: enrutar lo relativo al usuario autenticado.
//
// Estas rutas son especiales: se resuelven ANTES de seleccionar tenant, porque
// son justamente las que permiten descubrirlo o crearlo. Sólo necesitan una
// identidad válida.
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
  userId: string
): Promise<boolean> {
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
