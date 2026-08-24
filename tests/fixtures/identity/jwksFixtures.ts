import { createPublicKey, generateKeyPairSync, type KeyObject } from "node:crypto";
import type { JwksKeyStore } from "../../../platform/identity/application/JwksKeyStore.js";

/**
 * Fixtures de identidad para tests sin red.
 *
 * Reproduce la condición REAL verificada en el proyecto Neon: las ramas
 * `production` y `test` comparten la MISMA clave de firma, y sólo se distinguen
 * por el `iss`/`aud` que emiten. Por eso las dos "ramas" de estas fixtures
 * firman con la misma clave a propósito.
 */

export const PRODUCTION_ISSUER = "https://ep-produccion.neonauth.example/neondb";
export const TEST_ISSUER = "https://ep-test.neonauth.example/neondb";
export const SHARED_KID = "8a41b04e-640f-4692-bfee-f8b2e09af30d";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

// Se exporta a JWK y se reimporta a propósito: reproduce exactamente lo que
// hace HttpJwksKeyStore con la JWK que sirve Neon.
const sharedPublicKey = createPublicKey({
  key: publicKey.export({ format: "jwk" }),
  format: "jwk"
});

/** Store en memoria que sirve la clave compartida, igual que hace Neon. */
export function sharedKeyStore(): JwksKeyStore {
  return {
    findKey: async (kid: string): Promise<KeyObject | null> =>
      kid === SHARED_KID ? sharedPublicKey : null
  };
}

export function signingKey(): KeyObject {
  return privateKey;
}

export function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}
