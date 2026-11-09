import {
  PAYMENT_PROOF_TEST_MAX_BYTES,
  PAYMENT_PROOF_TEST_TYPES,
  type PaymentProofTestRequest,
  type PaymentProofTestResult
} from "../../../../contracts/PaymentProofTestContracts";
import type { RateLimiter } from "../../../../platform/security/rate-limiting/application/RateLimiter";
import type { RateLimitPolicy } from "../../../../platform/security/rate-limiting/contracts/RateLimitPolicy";
import { ValidationError } from "../../../../platform/observability/errors/ValidationError";
import { TooManyRequestsError } from "../../../../platform/observability/errors/TooManyRequestsError";
import type { PaymentProofTester } from "./ports/PaymentProofTester";

// ---------------------------------------------------------------------------
// TestPaymentProofService — «Probar» del Comprobante automático. Leer una
// imagen consume CPU del servidor: se limita por cuenta.
// ---------------------------------------------------------------------------

export const PAYMENT_PROOF_TEST_POLICY: RateLimitPolicy = { windowMs: 60_000, maxRequests: 10 };

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class TestPaymentProofService {
  public constructor(
    private readonly tester: PaymentProofTester,
    private readonly rateLimiter: RateLimiter,
    private readonly policy: RateLimitPolicy = PAYMENT_PROOF_TEST_POLICY
  ) {}

  public async execute(tenantId: string, input: Partial<PaymentProofTestRequest>): Promise<PaymentProofTestResult> {
    if (!isRecord(input.config)) throw new ValidationError("Falta la configuración del bloque Comprobante.");
    if (!isRecord(input.file)) throw new ValidationError("Sube una imagen o PDF del comprobante para probar.");

    const contentType = typeof input.file["contentType"] === "string" ? input.file["contentType"].toLowerCase() : "";
    if (!(PAYMENT_PROOF_TEST_TYPES as ReadonlyArray<string>).includes(contentType)) {
      throw new ValidationError("El comprobante debe ser una imagen (JPG, PNG, WebP) o un PDF.");
    }
    const data = typeof input.file["data"] === "string" ? input.file["data"].replace(/\s/g, "") : "";
    if (!data || data.length % 4 !== 0 || !BASE64.test(data)) throw new ValidationError("El archivo no llegó completo. Vuelve a subirlo.");
    const bytes = new Uint8Array(Buffer.from(data, "base64"));
    if (bytes.byteLength > PAYMENT_PROOF_TEST_MAX_BYTES) {
      throw new ValidationError(`El archivo pesa más de ${(PAYMENT_PROOF_TEST_MAX_BYTES / 1_000_000).toFixed(1)} MB.`);
    }

    const variables: Record<string, string> = {};
    if (input.variables !== undefined) {
      if (!isRecord(input.variables)) throw new ValidationError("Las variables de prueba no son válidas.");
      for (const [name, value] of Object.entries(input.variables)) {
        if (typeof value !== "string") throw new ValidationError(`La variable «${name}» debe ser texto.`);
        variables[name] = value;
      }
    }

    const limit = this.rateLimiter.check(`payment-proof-test:${tenantId}`, this.policy);
    if (!limit.allowed) throw new TooManyRequestsError("Demasiadas pruebas seguidas. Espera un momento.", limit.retryAfterMs);
    return this.tester.test(tenantId, input.config, { bytes, contentType }, variables);
  }
}
