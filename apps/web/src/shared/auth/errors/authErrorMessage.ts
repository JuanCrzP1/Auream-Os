import { AuthRequestError } from "../client/authFetch";
import { AUTH_ERROR_CODES } from "../contracts/AuthErrorCode";
import { MIN_PASSWORD_LENGTH } from "../contracts/passwordPolicy";

/**
 * Traduce un fallo de autenticación al mensaje que ve el usuario.
 *
 * Responsabilidad única: decidir el texto. No ejecuta acciones ni conoce React.
 *
 * Decide por CÓDIGO, no por status HTTP. Antes se colapsaba todo 400/401 en
 * "Credenciales incorrectas", lo que hacía indistinguible un registro
 * rechazado por contraseña corta de un login con contraseña equivocada.
 *
 * Nunca devuelve el mensaje crudo del proveedor: podría filtrar detalles
 * internos y no está traducido.
 */

const GENERIC_MESSAGE = "No se pudo completar la operación. Inténtalo de nuevo.";
const NETWORK_MESSAGE = "No se pudo conectar con el servicio de autenticación.";

const MESSAGES: Record<string, string> = {
  [AUTH_ERROR_CODES.invalidCredentials]: "Email o contraseña incorrectos.",
  [AUTH_ERROR_CODES.userAlreadyExists]: "Ya existe una cuenta con este correo. Inicia sesión.",
  [AUTH_ERROR_CODES.passwordTooShort]: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  [AUTH_ERROR_CODES.validationError]: "Revisa los datos introducidos.",
  [AUTH_ERROR_CODES.invalidToken]:
    "Este enlace de recuperación no es válido o ha caducado. Solicita uno nuevo.",
  [AUTH_ERROR_CODES.invalidOrigin]:
    "Esta dirección no está autorizada para iniciar sesión. Abre la aplicación desde su URL oficial."
};

export function authErrorMessage(error: unknown): string {
  if (!(error instanceof AuthRequestError)) {
    return NETWORK_MESSAGE;
  }

  if (error.code && MESSAGES[error.code]) {
    return MESSAGES[error.code]!;
  }

  return GENERIC_MESSAGE;
}
