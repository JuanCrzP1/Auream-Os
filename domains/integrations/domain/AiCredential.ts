import { AI_PROVIDER_IDS, type AiCredentialStatus, type AiProviderId } from "../../../contracts/AiContracts";

/**
 * Una conexión de la cuenta con un proveedor de IA. `secret` es el sobre
 * cifrado de la clave (ver `SecretCipher`); en claro no existe fuera del
 * momento de usarla.
 */
export interface AiCredential {
  readonly id: string;
  readonly tenantId: string;
  readonly provider: AiProviderId;
  readonly name: string;
  readonly secret: string;
  readonly hint: string;
  readonly status: AiCredentialStatus;
  readonly lastVerifiedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const MAX_AI_CREDENTIAL_NAME = 60;
const MIN_KEY_LENGTH = 20;
const MAX_KEY_LENGTH = 512;

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === "string" && (AI_PROVIDER_IDS as ReadonlyArray<string>).includes(value);
}

export function normalizeCredentialName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length > 0 && name.length <= MAX_AI_CREDENTIAL_NAME ? name : null;
}

/** Forma plausible de una clave: sin espacios y de un largo razonable. */
export function normalizeApiKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  return key.length >= MIN_KEY_LENGTH && key.length <= MAX_KEY_LENGTH && !/\s/.test(key) ? key : null;
}

/** `••••3f9a`: lo único de la clave que se muestra. */
export function keyHint(apiKey: string): string {
  return `••••${apiKey.slice(-4)}`;
}

/** Contexto del cifrado: la clave solo se descifra en su cuenta y su conexión. */
export function secretContext(tenantId: string, credentialId: string): string {
  return `ai-credential:${tenantId}:${credentialId}`;
}
