import { PIXEL_ID_PATTERN, type PixelConnectionStatus } from "../../../contracts/PixelContracts";

/**
 * Un píxel de Meta conectado a la cuenta. `secret` es el sobre cifrado del
 * token de la API de Conversiones (ver `SecretCipher`).
 */
export interface PixelConnection {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly pixelId: string;
  readonly secret: string;
  readonly tokenHint: string;
  readonly status: PixelConnectionStatus;
  readonly lastVerifiedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const MAX_PIXEL_NAME = 60;

export function normalizePixelName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length > 0 && name.length <= MAX_PIXEL_NAME ? name : null;
}

export function normalizePixelId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return PIXEL_ID_PATTERN.test(id) ? id : null;
}

/** Los tokens de Meta son largos y sin espacios. */
export function normalizeAccessToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return token.length >= 30 && token.length <= 1024 && !/\s/.test(token) ? token : null;
}

export function tokenHint(token: string): string {
  return `••••${token.slice(-4)}`;
}

/** Contexto del cifrado: el token solo se descifra en su cuenta y su conexión. */
export function pixelSecretContext(tenantId: string, connectionId: string): string {
  return `pixel-connection:${tenantId}:${connectionId}`;
}
