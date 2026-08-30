/**
 * Códigos de error que emite Neon Auth, tal y como llegan en el cuerpo JSON.
 *
 * Fuente única de estos literales. Están verificados contra la rama `test` del
 * proveedor: no son suposiciones. Un código que no esté aquí se trata como
 * desconocido y recibe un mensaje genérico — nunca se muestra crudo al usuario.
 *
 * El status HTTP NO basta para decidir el mensaje: el proveedor devuelve 400
 * tanto para "contraseña demasiado corta" como para "token inválido", y 401
 * tanto para credenciales incorrectas como para sesión ausente.
 */
export const AUTH_ERROR_CODES = {
  /** Email o contraseña no coinciden. También cuando el usuario no existe:
   *  el proveedor no distingue, a propósito, para no enumerar cuentas. */
  invalidCredentials: "INVALID_EMAIL_OR_PASSWORD",
  /** Ya hay una cuenta con ese email. Llega con status 422. */
  userAlreadyExists: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
  /** La contraseña no alcanza el mínimo que exige el proveedor. */
  passwordTooShort: "PASSWORD_TOO_SHORT",
  /** El cuerpo no pasó la validación del proveedor (email mal formado, etc.). */
  validationError: "VALIDATION_ERROR",
  /** Token de recuperación inexistente, ya usado o caducado. */
  invalidToken: "INVALID_TOKEN",
  /** El origen del navegador no está en la lista de confianza del proveedor.
   *  Es un fallo de configuración del despliegue, no del usuario. */
  invalidOrigin: "INVALID_ORIGIN"
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];
