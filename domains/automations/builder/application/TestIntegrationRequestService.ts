import type { IntegrationTestRequest, IntegrationTestResult } from "../../../../contracts/IntegrationTestContracts";
import type { RateLimiter } from "../../../../platform/security/rate-limiting/application/RateLimiter";
import type { RateLimitPolicy } from "../../../../platform/security/rate-limiting/contracts/RateLimitPolicy";
import { ValidationError } from "../../../../platform/observability/errors/ValidationError";
import { TooManyRequestsError } from "../../../../platform/observability/errors/TooManyRequestsError";
import type { IntegrationRequestTester } from "./ports/IntegrationRequestTester";

// ---------------------------------------------------------------------------
// TestIntegrationRequestService — el botón «Probar» del bloque Integración.
//
// Valida la entrada y limita cuántas pruebas hace cada cuenta por minuto: la
// plataforma no puede usarse como proxy para disparar peticiones a terceros.
// Quién conecta y con qué protecciones es del puerto.
// ---------------------------------------------------------------------------

export const INTEGRATION_TEST_POLICY: RateLimitPolicy = { windowMs: 60_000, maxRequests: 20 };

const MAX_VARIABLES = 50;
const MAX_VARIABLE_LENGTH = 2000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class TestIntegrationRequestService {
  public constructor(
    private readonly tester: IntegrationRequestTester,
    private readonly rateLimiter: RateLimiter,
    private readonly policy: RateLimitPolicy = INTEGRATION_TEST_POLICY
  ) {}

  public async execute(tenantId: string, input: Partial<IntegrationTestRequest>): Promise<IntegrationTestResult> {
    if (!isRecord(input.config)) throw new ValidationError("Falta la configuración de la integración.");

    const variables: Record<string, string> = {};
    if (input.variables !== undefined) {
      if (!isRecord(input.variables)) throw new ValidationError("Las variables deben ser un objeto.");
      const entries = Object.entries(input.variables);
      if (entries.length > MAX_VARIABLES) throw new ValidationError(`Como máximo ${MAX_VARIABLES} variables.`);
      for (const [name, value] of entries) {
        if (typeof value !== "string" || value.length > MAX_VARIABLE_LENGTH) {
          throw new ValidationError(`La variable «${name}» debe ser un texto de hasta ${MAX_VARIABLE_LENGTH} caracteres.`);
        }
        variables[name] = value;
      }
    }

    const limit = this.rateLimiter.check(`integration-test:${tenantId}`, this.policy);
    if (!limit.allowed) {
      throw new TooManyRequestsError("Demasiadas pruebas seguidas. Espera un momento y vuelve a intentarlo.", limit.retryAfterMs);
    }

    return this.tester.test(input.config, variables);
  }
}
