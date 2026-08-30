import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { createTestSqlClient } from "./setup/testDatabase.js";
import {
  callAuth,
  cleanupTestAuthUsers,
  createTestUser,
  obtainResetToken,
  requestPasswordReset,
  uniqueTestEmail
} from "./setup/testAuthUsers.js";

// ---------------------------------------------------------------------------
// Ciclo real de credenciales contra Neon Auth en la rama `test`.
//
// Es la prueba que cierra la Fase 1: registrar, salir y volver a entrar con la
// MISMA contraseña, y recuperar la contraseña de punta a punta.
//
// Toda cuenta creada aquí se borra en `afterAll`, pase o falle la suite.
// ---------------------------------------------------------------------------

const PASSWORD = "contrasena-de-prueba-2026";
const NEW_PASSWORD = "contrasena-nueva-2026";

let sql: SqlClient;

beforeAll(() => {
  sql = createTestSqlClient();
});

afterAll(async () => {
  await cleanupTestAuthUsers(sql);
  await sql.close();
});

describe("registro, salida y vuelta a entrar", () => {
  it("permite iniciar sesión con la misma contraseña del registro", async () => {
    const email = uniqueTestEmail("lifecycle");

    const userId = await createTestUser(email, PASSWORD, "Ciclo");

    expect((await callAuth("/sign-out", {})).status).toBe(200);

    const signIn = await callAuth("/sign-in/email", { email, password: PASSWORD });
    expect(signIn.status).toBe(200);
    expect(signIn.userId).toBe(userId);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const email = uniqueTestEmail("badpass");
    await createTestUser(email, PASSWORD, "Mala");

    const result = await callAuth("/sign-in/email", { email, password: "otra-contrasena-2026" });

    expect(result.status).toBe(401);
    expect(result.code).toBe("INVALID_EMAIL_OR_PASSWORD");
  });

  it("no distingue un usuario inexistente de una contraseña incorrecta", async () => {
    const email = uniqueTestEmail("enum");
    await createTestUser(email, PASSWORD, "Enum");

    const wrongPassword = await callAuth("/sign-in/email", { email, password: "no-es-2026" });
    const noSuchUser = await callAuth("/sign-in/email", {
      email: uniqueTestEmail("ghost"),
      password: "no-es-2026"
    });

    expect(noSuchUser.status).toBe(wrongPassword.status);
    expect(noSuchUser.code).toBe(wrongPassword.code);
  });

  it("rechaza registrar dos veces el mismo email sin invalidar la cuenta existente", async () => {
    const email = uniqueTestEmail("dup");
    await createTestUser(email, PASSWORD, "Uno");

    const duplicate = await callAuth("/sign-up/email", {
      email,
      password: "otra-distinta-2026",
      name: "Dos"
    });

    expect(duplicate.status).toBe(422);
    expect(duplicate.code).toBe("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL");
    // La contraseña original sigue siendo la válida.
    expect((await callAuth("/sign-in/email", { email, password: PASSWORD })).status).toBe(200);
  });

  it("trata el email como insensible a mayúsculas", async () => {
    const email = uniqueTestEmail("case");
    await createTestUser(email.toUpperCase(), PASSWORD, "Case");

    expect((await callAuth("/sign-in/email", { email, password: PASSWORD })).status).toBe(200);
  });

  it("rechaza una contraseña por debajo del mínimo con un código propio", async () => {
    const result = await callAuth("/sign-up/email", {
      email: uniqueTestEmail("short"),
      password: "corta12",
      name: "Corta"
    });

    expect(result.status).toBe(400);
    expect(result.code).toBe("PASSWORD_TOO_SHORT");
  });
});

describe("recuperación de contraseña", () => {
  it("recorre el ciclo completo con un único enlace de recuperación", async () => {
    const email = uniqueTestEmail("reset");
    const userId = await createTestUser(email, PASSWORD, "Reset");

    // Pide el enlace y devuelve el token real emitido por el proveedor. Si no
    // llega, lanza: aquí no hay nada que sondear ni reintentar.
    const token = await obtainResetToken(sql, email, userId);

    // Caduca en una hora. No se puede esperar a que ocurra dentro de un test:
    // se comprueba la caducidad declarada, y que un token no válido se rechaza
    // lo cubre el caso del token inventado.
    const expiry = await sql.query<{ minutes: string }>(
      `select extract(epoch from ("expiresAt" - now())) / 60 as minutes
         from neon_auth.verification
        where value = $1 and identifier like 'reset-password:%'
        order by "createdAt" desc limit 1`,
      [userId]
    );
    expect(Number(expiry.rows[0]!.minutes)).toBeGreaterThan(50);
    expect(Number(expiry.rows[0]!.minutes)).toBeLessThanOrEqual(60);

    // El cambio surte efecto.
    expect((await callAuth("/reset-password", { token, newPassword: NEW_PASSWORD })).status).toBe(200);

    // El token es de un solo uso.
    const reuse = await callAuth("/reset-password", { token, newPassword: "tercera-clave-2026" });
    expect(reuse.status).toBe(400);
    expect(reuse.code).toBe("INVALID_TOKEN");

    // La contraseña anterior deja de servir y la nueva funciona.
    const old = await callAuth("/sign-in/email", { email, password: PASSWORD });
    expect(old.status).toBe(401);
    expect(old.code).toBe("INVALID_EMAIL_OR_PASSWORD");
    expect((await callAuth("/sign-in/email", { email, password: NEW_PASSWORD })).status).toBe(200);
  });

  it("rechaza un token inventado", async () => {
    const result = await callAuth("/reset-password", {
      token: "token-que-no-existe",
      newPassword: NEW_PASSWORD
    });

    expect(result.status).toBe(400);
    expect(result.code).toBe("INVALID_TOKEN");
  });

  it("responde igual exista o no la cuenta, para no enumerar usuarios", async () => {
    const email = uniqueTestEmail("known");
    await createTestUser(email, PASSWORD, "Conocida");

    const known = await requestPasswordReset(email);
    const unknown = await requestPasswordReset(uniqueTestEmail("unknown"));

    expect(known).toBe(200);
    expect(unknown).toBe(known);
  });
});
