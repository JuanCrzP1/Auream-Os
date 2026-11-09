import { createServer } from "node:http";
import { loadEnvFile } from "./config/loadEnvFile";
import { ApiConfigError } from "./config/loadApiConfig";
import { composeApiApplication, type ApiApplication } from "./bootstrap/composeApiApplication";

// ---------------------------------------------------------------------------
// Entrypoint de la API como servidor (desarrollo local o un servidor propio).
//
// Responsabilidad única: cargar `.env`, componer la aplicación y escuchar.
// En Vercel no se usa: allí la sirve la función `api/index.ts`.
// ---------------------------------------------------------------------------

/**
 * Rondas de la cola en el proceso local, una tras otra, sin solaparse. La
 * ronda dura más que la reserva del trabajador (25 s): si no, no tomaría nada.
 */
function startLocalTaskLoop(app: ApiApplication, roundMs = 30_000): void {
  const loop = async () => {
    try {
      await app.tasks.run({ budgetMs: roundMs, waitForUpcoming: true });
    } catch (error) {
      console.error("[tareas]", error instanceof Error ? error.message : error);
    } finally {
      setTimeout(() => void loop(), 1_000).unref();
    }
  };
  setTimeout(() => void loop(), 2_000).unref();
}

function start(): void {
  let app: ApiApplication;

  try {
    loadEnvFile();
    app = composeApiApplication();
  } catch (error) {
    if (error instanceof ApiConfigError) {
      console.error(`[FATAL] ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  createServer((request, response) => void app.listener(request, response)).listen(app.config.port, () => {
    console.log(`API escuchando en http://localhost:${app.config.port}`);
  });

  // Fuera de Vercel no hay tarea programada: el servidor local corre él mismo
  // una ronda de la cola cada pocos segundos (Programador, tiempos de espera).
  startLocalTaskLoop(app);
}

start();
