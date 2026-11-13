import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { composeApiApplication, type ApiApplication } from "../../../apps/api/bootstrap/composeApiApplication.js";
import { createSimulatorApp, type SimulatorApp } from "../../../apps/wa-sim/server.js";
import { loadSimulatorConfig } from "../../../apps/wa-sim/config.js";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "../../integration/setup/testDatabase.js";
import { requireTestDatabaseUrl } from "../../integration/setup/requireTestDatabase.js";
import type { Clients } from "../../../apps/wa-sim/demo/steps.js";

// ---------------------------------------------------------------------------
// La pila de un recorrido de punta a punta, en el mismo proceso:
//
//   WhatsApp simulado (uazapi falso + teléfono de prueba)
//        ⇅  el cliente REAL de uazapi de Auream y sus avisos
//   API de Auream de verdad (composeApiApplication), con la base de PRUEBAS
//        ⇅  peticiones HTTP como las de la web, con la clave de desarrollo
//   el recorrido (asesor y cliente)
//
// Una cuenta nueva por corrida (clave `it-e2e-…`), que se borra al terminar.
// Nunca toca producción: la base pasa por `requireTestDatabaseUrl`.
// ---------------------------------------------------------------------------

/** `api` entra con la clave de desarrollo a la cuenta de la corrida; `phone` es el teléfono de prueba. */
export interface Stack extends Clients {
  readonly tenantId: string;
  /** La dirección de la API (para hablar con `/mcp` con un token de agente). */
  readonly apiBase: string;
  readonly sql: SqlClient;
  readonly app: ApiApplication;
  stop(): Promise<void>;
}

const listen = (server: Server) => new Promise<number>((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port)));
const close = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

/** Un puerto libre para la API (su dirección debe saberse antes de componerla). */
async function freePort(): Promise<number> {
  const probe = createServer();
  const port = await listen(probe);
  await close(probe);
  return port;
}

export async function startStack(name: string): Promise<Stack> {
  const databaseUrl = requireTestDatabaseUrl();
  const sql = createTestSqlClient();
  const tenantId = (await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, $2) returning id", [`${TEST_KEY_PREFIX}e2e-${name}-${Date.now()}`, `Recorrido ${name}`])).rows[0]!.id;

  const servers: Server[] = [];
  const release = async () => {
    await Promise.all(servers.map(close));
    await cleanupTestData(sql);
    await sql.close();
  };
  try {
    return await compose(sql, tenantId, databaseUrl, servers, release);
  } catch (error) {
    await release();
    throw error;
  }
}

async function compose(sql: SqlClient, tenantId: string, databaseUrl: string, servers: Server[], release: () => Promise<void>): Promise<Stack> {
  const simConfig = { ...loadSimulatorConfig({}, process.cwd()), port: 0, dataDir: mkdtempSync(join(tmpdir(), "auream-e2e-sim-")) };
  const sim: SimulatorApp = createSimulatorApp(simConfig, { persist: false, deliveryDelayMs: 20 });
  const simBase = `http://127.0.0.1:${await listen(sim.server)}`;
  servers.push(sim.server);

  const port = await freePort();
  const apiBase = `http://127.0.0.1:${port}`;
  const apiKey = `bfk_e2e${randomBytes(16).toString("hex")}`;
  const app = composeApiApplication({
    NODE_ENV: "development",
    PORT: String(port),
    DATABASE_URL: databaseUrl,
    DATABASE_POOL_MAX: "4",
    // Nadie inicia sesión: el recorrido entra con la clave de desarrollo (nunca existe en producción).
    NEON_AUTH_URL: "https://auth.e2e.invalid",
    NEON_AUTH_ISSUER: "https://auth.e2e.invalid",
    DEV_API_KEY: apiKey,
    DEV_TENANT_ID: tenantId,
    AUTOMATIONS_STORE: "sql",
    CORS_ALLOWED_ORIGINS: "http://localhost:5173",
    WHATSAPP_SIMULATOR_URL: simBase,
    WHATSAPP_WEBHOOK_BASE_URL: apiBase,
    INTEGRATIONS_ALLOW_PRIVATE_NETWORK: "true",
    // Cifra el token de cada número: una clave nueva por corrida, solo en memoria.
    CREDENTIALS_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    DATA_DIR: mkdtempSync(join(tmpdir(), "auream-e2e-data-"))
  });
  const apiServer = createServer((request, response) => void app.listener(request, response));
  await new Promise<void>((resolve) => apiServer.listen(port, "127.0.0.1", () => resolve()));
  servers.push(apiServer);

  const call = async <T>(base: string, method: string, path: string, body: unknown, headers: Record<string, string>) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : {}) as T };
  };

  return {
    tenantId,
    apiBase,
    sql,
    app,
    api: <T>(method: string, path: string, body?: unknown) => call<T>(apiBase, method, path, body, { "x-api-key": apiKey }),
    phone: async <T>(method: string, path: string, body?: unknown) => (await call<T>(simBase, method, path, body, {})).body,
    stop: release
  };
}
