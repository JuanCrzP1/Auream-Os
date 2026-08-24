import type { ServerResponse } from "node:http";
import { sendJson } from "../http/sendJson";
import type { OnboardingPort } from "../../../domains/team/application/OnboardingPort";

/**
 * `POST /me/onboarding` — garantiza que el usuario tenga un tenant inicial.
 *
 * Idempotente: si ya pertenece a uno, lo devuelve sin crear nada. Es seguro
 * llamarlo tras cada login o al recargar el navegador.
 */
export async function handleOnboardingRequest(
  response: ServerResponse,
  onboarding: OnboardingPort,
  userId: string,
  tenantName: string
): Promise<void> {
  const result = await onboarding.ensureInitialTenant(userId, tenantName);

  sendJson(response, result.created ? 201 : 200, {
    tenantId: result.tenantId,
    tenantKey: result.tenantKey,
    tenantName: result.tenantName,
    role: result.membership.role,
    created: result.created
  });
}
