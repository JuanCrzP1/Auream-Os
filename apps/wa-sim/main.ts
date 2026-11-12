import { loadSimulatorConfig, SimulatorConfigError } from "./config";
import { createSimulatorApp } from "./server";

// ---------------------------------------------------------------------------
// Arranca el WhatsApp simulado (solo desarrollo):
//
//   npm run sim        compila y abre http://localhost:3200
//
// En la API: WHATSAPP_SIMULATOR_URL=http://localhost:3200 (ver apps/wa-sim/README.md).
// ---------------------------------------------------------------------------

function start(): void {
  let config;
  try {
    config = loadSimulatorConfig();
  } catch (error) {
    if (error instanceof SimulatorConfigError) {
      console.error(`✗ ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  const { server, store } = createSimulatorApp(config);
  server.listen(config.port, () => {
    console.log(`WhatsApp simulado listo: ${config.publicBase}`);
    console.log(`  · teléfono de prueba:  ${config.publicBase}`);
    console.log(`  · avisa a Auream en:   ${config.fallbackWebhookUrl} (hasta que Auream configure el suyo)`);
    console.log(`  · estado guardado en:  ${config.dataDir}`);
  });

  const stop = () => {
    store.flush();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

start();
