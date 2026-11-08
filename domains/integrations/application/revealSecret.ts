import { SecretDecryptionError, type SecretCipher } from "../../../platform/security/secrets/SecretCipher";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

/**
 * Un secreto guardado, en claro, para usarlo en el momento. Si no se puede
 * descifrar (otra clave maestra, sobre alterado) lo explica en vez de un 500.
 */
export function revealSecret(cipher: SecretCipher, envelope: string, context: string, what: string): string {
  try {
    return cipher.decrypt(envelope, context);
  } catch (error) {
    if (error instanceof SecretDecryptionError) {
      throw new ValidationError(`No se pudo leer ${what} guardado. Vuelve a pegarlo.`);
    }
    throw error;
  }
}
