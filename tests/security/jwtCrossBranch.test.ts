import { describe, expect, it } from "vitest";
import { JwksTokenVerifier } from "../../platform/identity/application/JwksTokenVerifier.js";
import {
  PRODUCTION_ISSUER,
  TEST_ISSUER,
  sharedKeyStore
} from "../fixtures/identity/jwksFixtures.js";
import { mintToken } from "../fixtures/identity/mintToken.js";

// ---------------------------------------------------------------------------
// Aislamiento entre ramas de Neon.
//
// Condición real verificada en el proyecto: `production` y `test` comparten la
// MISMA clave JWKS, porque la tabla `jwks` se copia al ramificar. La firma, por
// tanto, NO distingue entornos. Lo único que los separa es `iss`/`aud`.
//
// Estos tests fijan esa garantía: sin ellos, un token de test sería
// criptográficamente válido en producción.
// ---------------------------------------------------------------------------

function productionVerifier(): JwksTokenVerifier {
  return new JwksTokenVerifier({
    keyStore: sharedKeyStore(),
    expectedIssuer: PRODUCTION_ISSUER,
    expectedAudience: PRODUCTION_ISSUER
  });
}

function testVerifier(): JwksTokenVerifier {
  return new JwksTokenVerifier({
    keyStore: sharedKeyStore(),
    expectedIssuer: TEST_ISSUER,
    expectedAudience: TEST_ISSUER
  });
}

describe("JwksTokenVerifier — aislamiento entre ramas", () => {
  it("token de TEST es rechazado por PRODUCTION pese a tener firma válida", async () => {
    const token = mintToken({ iss: TEST_ISSUER });

    await expect(productionVerifier().verify(token)).rejects.toThrow(/Emisor no reconocido/);
  });

  it("token de PRODUCTION es rechazado por TEST pese a tener firma válida", async () => {
    const token = mintToken({ iss: PRODUCTION_ISSUER });

    await expect(testVerifier().verify(token)).rejects.toThrow(/Emisor no reconocido/);
  });

  it("cada verificador acepta el token de su propia rama", async () => {
    const prodIdentity = await productionVerifier().verify(
      mintToken({ iss: PRODUCTION_ISSUER, sub: "user-prod" })
    );
    const testIdentity = await testVerifier().verify(
      mintToken({ iss: TEST_ISSUER, sub: "user-test" })
    );

    expect(prodIdentity.actorId).toBe("user-prod");
    expect(testIdentity.actorId).toBe("user-test");
  });

  it("audiencia incorrecta es rechazada aunque el emisor coincida", async () => {
    const token = mintToken({ iss: PRODUCTION_ISSUER, aud: TEST_ISSUER });

    await expect(productionVerifier().verify(token)).rejects.toThrow(/Audiencia no reconocida/);
  });
});

describe("JwksTokenVerifier — validaciones de token", () => {
  it("rechaza una firma manipulada", async () => {
    const token = mintToken({ iss: PRODUCTION_ISSUER });
    const tampered = `${token.slice(0, -6)}AAAAAA`;

    await expect(productionVerifier().verify(tampered)).rejects.toThrow(/Firma inválida/);
  });

  it("rechaza un kid desconocido sin usar ninguna clave por defecto", async () => {
    const token = mintToken({ iss: PRODUCTION_ISSUER, kid: "kid-inexistente" });

    await expect(productionVerifier().verify(token)).rejects.toThrow(/Clave de firma desconocida/);
  });

  it("rechaza un algoritmo no permitido", async () => {
    const token = mintToken({ iss: PRODUCTION_ISSUER, alg: "HS256" });

    await expect(productionVerifier().verify(token)).rejects.toThrow(/Algoritmo no permitido/);
  });

  it("rechaza un token expirado", async () => {
    const token = mintToken({ iss: PRODUCTION_ISSUER, expiresInSeconds: -10 });

    await expect(productionVerifier().verify(token)).rejects.toThrow(/Token expirado/);
  });

  it("rechaza un token emitido en el futuro", async () => {
    const token = mintToken({ iss: PRODUCTION_ISSUER, issuedAtOffsetSeconds: 600 });

    await expect(productionVerifier().verify(token)).rejects.toThrow(/emitido en el futuro/);
  });

  it("rechaza una estructura de token inválida", async () => {
    await expect(productionVerifier().verify("solo.dos")).rejects.toThrow(/Estructura/);
  });

  it("IGNORA scopes y tenant inyectados en los claims", async () => {
    const token = mintToken({
      iss: PRODUCTION_ISSUER,
      sub: "user-x",
      extraClaims: {
        scopes: ["flows.publish", "tenant.manage"],
        tenant: "tenant-ajeno",
        role: "platform_admin"
      }
    });

    const identity = await productionVerifier().verify(token);

    expect(identity).toEqual({ actorId: "user-x" });
    expect(identity).not.toHaveProperty("scopes");
    expect(identity).not.toHaveProperty("tenantId");
  });
});
