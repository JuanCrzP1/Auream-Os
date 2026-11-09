import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { AesGcmSecretCipher, readSecretKeyRing } from "../../platform/security/secrets/AesGcmSecretCipher.js";
import { SecretDecryptionError } from "../../platform/security/secrets/SecretCipher.js";

// ---------------------------------------------------------------------------
// Cifrado de secretos de clientes: AES-256-GCM, atado a su dueño y con
// rotación de clave maestra.
// ---------------------------------------------------------------------------

const k1 = randomBytes(32);
const k2 = randomBytes(32);
const cipher = new AesGcmSecretCipher({ current: "v1", keys: { v1: k1 } });

describe("AesGcmSecretCipher", () => {
  it("cifra y descifra; el sobre no contiene el secreto y cambia en cada cifrado", () => {
    const a = cipher.encrypt("sk-secreto-123", "t1:c1");
    const b = cipher.encrypt("sk-secreto-123", "t1:c1");
    expect(a).not.toContain("secreto");
    expect(a).not.toBe(b);
    expect(a.startsWith("v1.")).toBe(true);
    expect(cipher.decrypt(a, "t1:c1")).toBe("sk-secreto-123");
  });

  it("no descifra con otro contexto (otra cuenta u otra conexión)", () => {
    const sobre = cipher.encrypt("sk-secreto", "t1:c1");
    expect(() => cipher.decrypt(sobre, "t2:c1")).toThrow(SecretDecryptionError);
    expect(() => cipher.decrypt(sobre, "t1:c2")).toThrow(SecretDecryptionError);
  });

  it("detecta un sobre alterado o mal formado", () => {
    const [v, iv, tag, ct] = cipher.encrypt("sk-secreto", "x").split(".");
    // Se invierte un byte del cifrado: siempre cambia (cambiar letras al azar a veces no cambia nada).
    const bytes = Buffer.from(ct!, "base64url");
    bytes[0] = bytes[0]! ^ 0xff;
    const alterado = [v, iv, tag, bytes.toString("base64url")].join(".");
    expect(() => cipher.decrypt(alterado, "x")).toThrow(SecretDecryptionError);
    expect(() => cipher.decrypt("basura", "x")).toThrow(SecretDecryptionError);
  });

  it("rotación: cifra con la clave nueva y sigue leyendo lo cifrado con la anterior", () => {
    const viejo = cipher.encrypt("sk-viejo", "x");
    const rotado = new AesGcmSecretCipher({ current: "v2", keys: { v1: k1, v2: k2 } });
    expect(rotado.decrypt(viejo, "x")).toBe("sk-viejo");
    expect(rotado.encrypt("sk-nuevo", "x").startsWith("v2.")).toBe(true);
    expect(() => new AesGcmSecretCipher({ current: "v2", keys: { v2: k2 } }).decrypt(viejo, "x")).toThrow(/v1/);
  });

  it("rechaza claves maestras de largo incorrecto", () => {
    expect(() => new AesGcmSecretCipher({ current: "v1", keys: { v1: randomBytes(16) } })).toThrow(/32 bytes/);
  });

  it("lee el anillo del entorno (actual + anteriores)", () => {
    const ring = readSecretKeyRing({
      CREDENTIALS_ENCRYPTION_KEY: k2.toString("base64"),
      CREDENTIALS_ENCRYPTION_KEY_VERSION: "v2",
      CREDENTIALS_ENCRYPTION_OLD_KEYS: `v1:${k1.toString("base64")}`
    });
    expect(ring?.current).toBe("v2");
    expect(Object.keys(ring!.keys).sort()).toEqual(["v1", "v2"]);
    expect(readSecretKeyRing({})).toBeNull();
  });
});
