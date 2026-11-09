import type { PixelTestRequest, PixelTestResult } from "../../../../contracts/PixelTestContracts";
import type { RateLimiter } from "../../../../platform/security/rate-limiting/application/RateLimiter";
import type { RateLimitPolicy } from "../../../../platform/security/rate-limiting/contracts/RateLimitPolicy";
import { ValidationError } from "../../../../platform/observability/errors/ValidationError";
import { TooManyRequestsError } from "../../../../platform/observability/errors/TooManyRequestsError";
import type { PixelEventTester } from "./ports/PixelEventTester";

// ---------------------------------------------------------------------------
// TestPixelEventService — «Probar» del bloque Pixel. EXIGE el código de
// «Probar eventos» del Administrador de eventos: así una prueba nunca cuenta
// como conversión real ni altera las campañas.
// ---------------------------------------------------------------------------

export const PIXEL_TEST_POLICY: RateLimitPolicy = { windowMs: 60_000, maxRequests: 20 };

/** Los códigos de prueba de Meta: `TEST` + letras y números. */
const TEST_CODE = /^TEST[A-Za-z0-9]{1,30}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class TestPixelEventService {
  public constructor(
    private readonly tester: PixelEventTester,
    private readonly rateLimiter: RateLimiter,
    private readonly policy: RateLimitPolicy = PIXEL_TEST_POLICY
  ) {}

  public async execute(tenantId: string, input: Partial<PixelTestRequest>): Promise<PixelTestResult> {
    if (!isRecord(input.config)) throw new ValidationError("Falta la configuración del bloque Pixel.");
    const code = typeof input.testEventCode === "string" ? input.testEventCode.trim() : "";
    if (!TEST_CODE.test(code)) {
      throw new ValidationError("Pega el código de prueba del Administrador de eventos de Meta (empieza por TEST, p. ej. TEST12345).");
    }
    const variables: Record<string, string> = {};
    if (input.variables !== undefined) {
      if (!isRecord(input.variables)) throw new ValidationError("Las variables de prueba no son válidas.");
      for (const [name, value] of Object.entries(input.variables)) {
        if (typeof value !== "string") throw new ValidationError(`La variable «${name}» debe ser texto.`);
        variables[name] = value;
      }
    }

    const limit = await this.rateLimiter.check(`pixel-test:${tenantId}`, this.policy);
    if (!limit.allowed) throw new TooManyRequestsError("Demasiadas pruebas seguidas. Espera un momento.", limit.retryAfterMs);
    return this.tester.test(tenantId, input.config, code, variables);
  }
}
