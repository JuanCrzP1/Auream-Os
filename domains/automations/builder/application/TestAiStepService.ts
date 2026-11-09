import type { AiTestRequest, AiTestResult } from "../../../../contracts/AiTestContracts";
import type { RateLimiter } from "../../../../platform/security/rate-limiting/application/RateLimiter";
import type { RateLimitPolicy } from "../../../../platform/security/rate-limiting/contracts/RateLimitPolicy";
import { ValidationError } from "../../../../platform/observability/errors/ValidationError";
import { TooManyRequestsError } from "../../../../platform/observability/errors/TooManyRequestsError";
import type { AiStepTester } from "./ports/AiStepTester";

// ---------------------------------------------------------------------------
// TestAiStepService — el botón «Probar» de la Extensión IA. Cada prueba
// consume saldo del proveedor del cliente: se limita por cuenta.
// ---------------------------------------------------------------------------

export const AI_TEST_POLICY: RateLimitPolicy = { windowMs: 60_000, maxRequests: 10 };

const MAX_MESSAGE = 4000;
const MAX_VARIABLES = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class TestAiStepService {
  public constructor(
    private readonly tester: AiStepTester,
    private readonly rateLimiter: RateLimiter,
    private readonly policy: RateLimitPolicy = AI_TEST_POLICY
  ) {}

  public async execute(tenantId: string, input: Partial<AiTestRequest>): Promise<AiTestResult> {
    if (!isRecord(input.config)) throw new ValidationError("Falta la configuración del bloque de IA.");
    if (typeof input.message !== "string" || input.message.trim() === "" || input.message.length > MAX_MESSAGE) {
      throw new ValidationError(`Escribe un mensaje de prueba de hasta ${MAX_MESSAGE} caracteres.`);
    }
    const variables: Record<string, string> = {};
    if (input.variables !== undefined) {
      if (!isRecord(input.variables) || Object.keys(input.variables).length > MAX_VARIABLES) {
        throw new ValidationError("Las variables de prueba no son válidas.");
      }
      for (const [name, value] of Object.entries(input.variables)) {
        if (typeof value !== "string") throw new ValidationError(`La variable «${name}» debe ser texto.`);
        variables[name] = value;
      }
    }

    const limit = await this.rateLimiter.check(`ai-test:${tenantId}`, this.policy);
    if (!limit.allowed) {
      throw new TooManyRequestsError("Demasiadas pruebas de IA seguidas. Espera un momento y vuelve a intentarlo.", limit.retryAfterMs);
    }
    return this.tester.test(tenantId, input.config, input.message.trim(), variables);
  }
}
