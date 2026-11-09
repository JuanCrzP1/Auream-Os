import { loadEnvFile } from "../api/config/loadEnvFile";
import { ApiConfigError } from "../api/config/loadApiConfig";
import { composeApiApplication } from "../api/bootstrap/composeApiApplication";

// ---------------------------------------------------------------------------
// Worker — trabajador de la cola de tareas (FASE C6) como proceso aparte.
//
// En Vercel no se usa: allí lo despiertan la tarea programada y la propia API
// (`/internal/tasks/run`). Sirve para un servidor propio o para correr la cola
// sin la API. Usa la MISMA composición que la API: los mismos manejadores,
// el mismo programador, la misma base. Rondas seguidas, sin solaparse; se
// detiene limpio con Ctrl+C.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  loadEnvFile();
  const app = composeApiApplication();
  let stopping = false;
  process.on("SIGINT", () => (stopping = true));
  process.on("SIGTERM", () => (stopping = true));
  console.log("[worker] cola de tareas en marcha");

  while (!stopping) {
    try {
      const report = await app.tasks.run({ budgetMs: 50_000, waitForUpcoming: true });
      if (report.claimed > 0) console.log("[worker]", JSON.stringify(report));
    } catch (error) {
      console.error("[worker]", error instanceof Error ? error.message : error);
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
  console.log("[worker] detenido");
  process.exit(0);
}

main().catch((error) => {
  console.error(`[FATAL] ${error instanceof ApiConfigError ? error.message : String(error)}`);
  process.exit(1);
});
