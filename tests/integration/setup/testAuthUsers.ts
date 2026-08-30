import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient.js";
import { requireTestAuthUrl } from "./requireTestAuth.js";

// ---------------------------------------------------------------------------
// Usuarios reales de Neon Auth para los tests de integración.
//
// Responsabilidad única: crear cuentas desechables contra la rama `test` y
// garantizar que se borran. Ningún test debe dejar usuarios detrás: la rama de
// test ya acumuló cuentas huérfanas por no tener esta pieza.
//
// El origen es obligatorio: el proveedor rechaza con `INVALID_ORIGIN` toda
// petición cuyo `Origin` no confíe, y en Node no lo pone nadie por nosotros.
// ---------------------------------------------------------------------------

/** Único origen de desarrollo que Neon Auth acepta. Ver docs/architecture/auth.md. */
const TRUSTED_ORIGIN = "http://localhost:5173";

/** Prefijo de los emails que crea la suite, para poder identificarlos. */
export const TEST_EMAIL_PREFIX = "it-auth-";

export interface AuthCallResult {
  readonly status: number;
  readonly code: string | null;
  readonly userId: string | null;
}

// ---------------------------------------------------------------------------
// Cadencia frente al límite de tasa del proveedor.
//
// Neon Auth limita por tasa el conjunto de sus endpoints de credenciales
// —alta, solicitud de recuperación y cambio— y responde 429 sin producir nada.
// Medido contra la rama `test`: una ráfaga sin pausa empieza a recibir 429 a
// partir de la cuarta petición.
//
// La suite hace decenas de llamadas seguidas, así que se serializan con una
// separación mínima. No es una espera arbitraria: es respetar el límite del
// proveedor, igual que haría cualquier cliente. Reintentar sin acompasar sólo
// consume más presupuesto y agrava el problema.
// ---------------------------------------------------------------------------

const MIN_CALL_SPACING_MS = 400;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Cola de un solo carril: garantiza la separación entre llamadas sucesivas. */
let callChain: Promise<void> = Promise.resolve();

function nextSlot(): Promise<void> {
  const slot = callChain.then(() => wait(MIN_CALL_SPACING_MS));
  callChain = slot;
  return slot;
}

/** Llama a un endpoint del proveedor. No lanza: el status es parte del caso. */
export async function callAuth(
  path: string,
  body: Record<string, unknown>
): Promise<AuthCallResult> {
  await nextSlot();

  const response = await fetch(`${requireTestAuthUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: TRUSTED_ORIGIN },
    body: JSON.stringify(body)
  });

  let parsed: { code?: string; user?: { id?: string } } | null = null;

  try {
    parsed = (await response.json()) as typeof parsed;
  } catch {
    parsed = null;
  }

  return {
    status: response.status,
    code: parsed?.code ?? null,
    userId: parsed?.user?.id ?? null
  };
}

/** Email desechable, único por llamada. */
export function uniqueTestEmail(label: string): string {
  return `${TEST_EMAIL_PREFIX}${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

// ---------------------------------------------------------------------------
// Presupuestos frente al límite de tasa del proveedor.
//
// Medidos contra la rama `test`. El proveedor limita por tasa TANTO el alta
// (`/sign-up/email`) COMO la solicitud de recuperación, y en ambos casos
// responde 429 sin producir nada. Una suite que encadena varias altas agota
// ese margen, así que toda preparación de usuarios reintenta de forma acotada.
//
// Cuando la solicitud sí se acepta, el token aparece en ~110 ms: la escritura
// ocurre DESPUÉS de responder, por eso además se espera por la condición.
// ---------------------------------------------------------------------------

const RESET_TOKEN_WAIT_MS = 3_000;
const RESET_TOKEN_POLL_MS = 100;
const THROTTLED_ATTEMPTS = 4;
const THROTTLE_BACKOFF_MS = 1_000;

/**
 * Crea una cuenta desechable y devuelve su id.
 *
 * Reintenta mientras el proveedor estrangule el alta: un 429 es una condición
 * del entorno de pruebas, no un resultado que ninguna prueba quiera observar.
 *
 * Lanza si no consigue crearla. Antes, un alta estrangulada pasaba inadvertida
 * y el fallo aparecía mucho más tarde, disfrazado de «no llegó el token de
 * recuperación» — cuando en realidad el usuario nunca había existido.
 *
 * Las pruebas que SÍ examinan la respuesta del alta (email duplicado,
 * contraseña corta) usan `callAuth` directamente: ahí el status es el sujeto.
 */
export async function createTestUser(
  email: string,
  password: string,
  name: string
): Promise<string> {
  let last: AuthCallResult = { status: 0, code: null, userId: null };

  for (let attempt = 0; attempt < THROTTLED_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await wait(THROTTLE_BACKOFF_MS * attempt);
    }

    last = await callAuth("/sign-up/email", { email, password, name });

    if (last.userId) {
      return last.userId;
    }

    if (last.status !== 429) {
      break;
    }
  }

  throw new Error(
    `No se pudo crear el usuario de prueba ${email} (status ${last.status}, code ${last.code}).`
  );
}

/**
 * Pide el envío del enlace de recuperación.
 *
 * El `redirectTo` es un detalle del proveedor —debe apuntar a un origen de
 * confianza suyo— y por eso se fija aquí, no en cada prueba.
 *
 * El endpoint está limitado por tasa: al estrangular responde 429, que no dice
 * nada sobre la cuenta ni sobre el flujo. Se reintenta de forma acotada para
 * devolver el status ASENTADO, el único que describe comportamiento real. Si
 * el límite persiste se devuelve 429 y quien llama decide.
 *
 * El cuerpo no se expone: es deliberadamente idéntico exista o no la cuenta.
 */
export async function requestPasswordReset(email: string): Promise<number> {
  let status = 0;

  for (let attempt = 0; attempt < THROTTLED_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await wait(THROTTLE_BACKOFF_MS * attempt);
    }

    const result = await callAuth("/request-password-reset", {
      email,
      redirectTo: `${TRUSTED_ORIGIN}/reset-password`
    });

    status = result.status;

    if (status !== 429) {
      return status;
    }
  }

  return status;
}

/**
 * Lectura puntual de la fila de verificación. Null si todavía no existe.
 *
 * Se busca por `value = userId` directamente, sin unir contra `user`: el
 * proveedor guarda ahí el identificador del dueño del token, y depender de la
 * unión hacía la consulta sensible a que la fila de usuario siguiera presente.
 */
async function findResetToken(sql: SqlClient, userId: string): Promise<string | null> {
  const result = await sql.query<{ identifier: string }>(
    `select identifier
       from neon_auth.verification
      where value = $1 and identifier like 'reset-password:%'
      order by "createdAt" desc
      limit 1`,
    [userId]
  );

  const identifier = result.rows[0]?.identifier;
  return identifier ? identifier.slice("reset-password:".length) : null;
}

/** Espera a que la fila exista, hasta agotar la ventana. Null si no llega. */
async function waitForResetToken(sql: SqlClient, userId: string): Promise<string | null> {
  const deadline = Date.now() + RESET_TOKEN_WAIT_MS;

  for (;;) {
    const token = await findResetToken(sql, userId);

    if (token) {
      return token;
    }

    if (Date.now() >= deadline) {
      return null;
    }

    await wait(RESET_TOKEN_POLL_MS);
  }
}

/**
 * Token de recuperación real emitido por el proveedor.
 *
 * Encapsula TODO el trato con el detalle eventual del proveedor, para que las
 * pruebas sólo expresen el flujo: pedir el enlace y usar el token.
 *
 * Se lee de la tabla de verificación en lugar de un buzón real: el correo lo
 * envía el proveedor y la suite no tiene acceso a ninguna bandeja. El token
 * viaja en el `identifier` (`reset-password:<token>`), no en `value`.
 *
 * Dos comportamientos del proveedor, ambos medidos contra la rama `test`,
 * obligan a esta forma:
 *
 *   1. La fila se escribe DESPUÉS de responder — por eso se espera por la
 *      condición «el token existe», no por un tiempo fijo: en cuanto aparece
 *      se devuelve, sin penalizar al caso rápido.
 *   2. `/request-password-reset` está limitado por tasa: al estrangular
 *      responde 429 y no emite token. Por eso se reintenta la SOLICITUD con
 *      espera creciente, en lugar de dar el flujo por roto.
 *
 * El límite de tasa no se oculta: se acomoda de forma acotada y explícita. Si
 * agotado el presupuesto no hay token, se lanza — un token que nunca llega es
 * un fallo real de la recuperación de contraseña y debe romper la prueba.
 */
export async function obtainResetToken(
  sql: SqlClient,
  email: string,
  userId: string
): Promise<string> {
  let lastStatus = 0;

  for (let attempt = 0; attempt < THROTTLED_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await wait(THROTTLE_BACKOFF_MS * attempt);
    }

    lastStatus = await requestPasswordReset(email);
    const token = await waitForResetToken(sql, userId);

    if (token) {
      return token;
    }
  }

  throw new Error(
    `El proveedor no emitió token de recuperación para ${email} tras ` +
      `${THROTTLED_ATTEMPTS} solicitudes (último status ${lastStatus}).`
  );
}

/**
 * Borra las cuentas creadas por la suite.
 *
 * Se ejecuta aunque un test falle: el borrado va por prefijo de email, no por
 * una lista en memoria que un fallo a mitad de test dejaría incompleta.
 */
export async function cleanupTestAuthUsers(sql: SqlClient): Promise<void> {
  await sql.query(`delete from neon_auth."user" where email like $1`, [TEST_EMAIL_PREFIX + "%"]);
}
