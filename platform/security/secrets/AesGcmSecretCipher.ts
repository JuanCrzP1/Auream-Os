import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { SecretDecryptionError, type SecretCipher } from "./SecretCipher";

// ---------------------------------------------------------------------------
// AES-256-GCM con IV aleatorio de 96 bits y etiqueta de 128 bits.
//
// Sobre: `<versión>.<iv>.<etiqueta>.<cifrado>` (base64url). Se cifra siempre
// con la clave actual; se descifra con la versión que diga el sobre, mientras
// esa clave siga configurada (rotación sin migración masiva).
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const VERSION = /^[A-Za-z0-9_-]{1,16}$/;

export interface SecretKeyRing {
  /** Versión con la que se cifra lo nuevo. */
  readonly current: string;
  /** Todas las claves que se pueden usar para descifrar, por versión. */
  readonly keys: Readonly<Record<string, Buffer>>;
}

export class AesGcmSecretCipher implements SecretCipher {
  public constructor(private readonly ring: SecretKeyRing) {
    if (!VERSION.test(ring.current)) throw new Error("Versión de clave maestra no válida.");
    for (const [version, key] of Object.entries(ring.keys)) {
      if (!VERSION.test(version) || key.length !== KEY_BYTES) {
        throw new Error(`La clave maestra «${version}» debe tener ${KEY_BYTES} bytes.`);
      }
    }
    if (!ring.keys[ring.current]) throw new Error("Falta la clave maestra actual.");
  }

  public encrypt(plaintext: string, context: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.ring.keys[this.ring.current]!, iv);
    cipher.setAAD(Buffer.from(context, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return [this.ring.current, iv, cipher.getAuthTag(), ciphertext]
      .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
      .join(".");
  }

  public decrypt(envelope: string, context: string): string {
    const parts = envelope.split(".");
    if (parts.length !== 4) throw new SecretDecryptionError("Sobre de secreto mal formado.");
    const [version, iv, tag, ciphertext] = parts as [string, string, string, string];
    const key = this.ring.keys[version];
    if (!key) throw new SecretDecryptionError(`No está configurada la clave maestra «${version}».`);

    try {
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64url"));
      decipher.setAAD(Buffer.from(context, "utf8"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
    } catch {
      throw new SecretDecryptionError();
    }
  }
}

/**
 * Lee el anillo de claves del entorno:
 *   CREDENTIALS_ENCRYPTION_KEY          clave actual, base64 de 32 bytes
 *   CREDENTIALS_ENCRYPTION_KEY_VERSION  su versión (por defecto `v1`)
 *   CREDENTIALS_ENCRYPTION_OLD_KEYS     anteriores, `v0:base64,v00:base64`
 * Devuelve `null` si no hay clave actual.
 */
export function readSecretKeyRing(env: NodeJS.ProcessEnv): SecretKeyRing | null {
  const raw = env["CREDENTIALS_ENCRYPTION_KEY"]?.trim();
  if (!raw) return null;
  const current = env["CREDENTIALS_ENCRYPTION_KEY_VERSION"]?.trim() || "v1";
  const keys: Record<string, Buffer> = { [current]: Buffer.from(raw, "base64") };
  for (const entry of (env["CREDENTIALS_ENCRYPTION_OLD_KEYS"] ?? "").split(",")) {
    const [version, value] = entry.split(":").map((part) => part.trim());
    if (version && value) keys[version] = Buffer.from(value, "base64");
  }
  return { current, keys };
}
