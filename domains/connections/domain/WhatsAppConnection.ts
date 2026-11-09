import {
  CONNECTION_METHODS,
  MAX_CONNECTION_NAME,
  type ConnectionMethod,
  type ConnectionStatus
} from "../../../contracts/ConnectionContracts";

/**
 * Un número de WhatsApp de la cuenta.
 *   providerRef     identificador de la sesión en el proveedor (instancia de
 *                   uazapi) o del número en Meta (API oficial)
 *   providerSecret  credencial de esa sesión, CIFRADA (ver `SecretCipher`)
 * Ninguno de los dos sale de la API.
 */
export interface WhatsAppConnection {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly method: ConnectionMethod;
  readonly status: ConnectionStatus;
  readonly phoneNumber: string | null;
  readonly profileName: string | null;
  /** Foto de perfil del número (enlace temporal del proveedor). */
  readonly profilePictureUrl: string | null;
  readonly providerRef: string | null;
  readonly providerSecret: string | null;
  readonly lastConnectedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function normalizeConnectionName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length > 0 && name.length <= MAX_CONNECTION_NAME ? name : null;
}

export function isConnectionMethod(value: unknown): value is ConnectionMethod {
  return typeof value === "string" && (CONNECTION_METHODS as ReadonlyArray<string>).includes(value);
}

/** Solo dígitos, con indicativo: entre 7 y 15 (E.164). */
export function normalizePhoneNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

/** Contexto del cifrado: la credencial solo se descifra en su cuenta y su conexión. */
export function connectionSecretContext(tenantId: string, connectionId: string): string {
  return `whatsapp-connection:${tenantId}:${connectionId}`;
}
