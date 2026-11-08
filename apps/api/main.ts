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
}

start();
