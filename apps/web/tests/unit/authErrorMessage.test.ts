import { describe, expect, it } from "vitest";
import { AuthRequestError } from "../../src/shared/auth/client/authFetch";
import { authErrorMessage } from "../../src/shared/auth/errors/authErrorMessage";
import { AUTH_ERROR_CODES } from "../../src/shared/auth/contracts/AuthErrorCode";

// ---------------------------------------------------------------------------
// El mapeo de errores es lo que hacía indistinguible un registro rechazado por
// contraseña corta de un login con contraseña equivocada: ambos eran 400/401 y
// ambos mostraban "Credenciales incorrectas". Estos casos fijan la distinción.
// ---------------------------------------------------------------------------

describe("authErrorMessage", () => {
  it("credenciales incorrectas dan un mensaje de credenciales", () => {
    const error = new AuthRequestError(401, "Invalid email or password", AUTH_ERROR_CODES.invalidCredentials);

    expect(authErrorMessage(error)).toBe("Email o contraseña incorrectos.");
  });

  it("email ya registrado invita a iniciar sesión, no habla de contraseñas", () => {
    const error = new AuthRequestError(422, "User already exists", AUTH_ERROR_CODES.userAlreadyExists);

    const message = authErrorMessage(error);

    expect(message).toContain("Ya existe una cuenta");
    expect(message).not.toMatch(/contraseña incorrect/i);
  });

  it("origen no autorizado no culpa al usuario de su contraseña", () => {
    const error = new AuthRequestError(403, "Invalid origin", AUTH_ERROR_CODES.invalidOrigin);

    const message = authErrorMessage(error);

    expect(message).toMatch(/no está autorizada/i);
    expect(message).not.toMatch(/contraseña incorrect/i);
  });

  it("contraseña demasiado corta dice el mínimo real, no 'credenciales incorrectas'", () => {
    const error = new AuthRequestError(400, "Password too short", AUTH_ERROR_CODES.passwordTooShort);

    const message = authErrorMessage(error);

    expect(message).toContain("8 caracteres");
    expect(message).not.toMatch(/incorrect/i);
  });

  it("token de recuperación inválido pide solicitar uno nuevo", () => {
    const error = new AuthRequestError(400, "Invalid token", AUTH_ERROR_CODES.invalidToken);

    expect(authErrorMessage(error)).toMatch(/no es válido o ha caducado/i);
  });

  it("un código desconocido cae en un mensaje genérico, nunca en el crudo del proveedor", () => {
    const error = new AuthRequestError(500, "internal db constraint xyz failed", "SOMETHING_NEW");

    const message = authErrorMessage(error);

    expect(message).toBe("No se pudo completar la operación. Inténtalo de nuevo.");
    expect(message).not.toContain("db constraint");
  });

  it("un error sin código tampoco expone el mensaje del proveedor", () => {
    const error = new AuthRequestError(400, "stack trace interno");

    expect(authErrorMessage(error)).not.toContain("stack trace");
  });

  it("un fallo de red se distingue de un rechazo del proveedor", () => {
    expect(authErrorMessage(new TypeError("Failed to fetch"))).toBe(
      "No se pudo conectar con el servicio de autenticación."
    );
  });

  it("dos códigos distintos con el mismo status producen mensajes distintos", () => {
    const short = new AuthRequestError(400, "Password too short", AUTH_ERROR_CODES.passwordTooShort);
    const token = new AuthRequestError(400, "Invalid token", AUTH_ERROR_CODES.invalidToken);

    expect(authErrorMessage(short)).not.toBe(authErrorMessage(token));
  });
});
