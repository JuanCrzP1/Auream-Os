import { join } from "node:path";

// ---------------------------------------------------------------------------
// Configuración del WhatsApp simulado (variables de entorno, todas opcionales):
//
//   SIM_PORT          puerto (3200)
//   SIM_ADMIN_TOKEN   el «admintoken» que Auream usa para crear números; debe
//                     coincidir con WHATSAPP_SIMULATOR_TOKEN de la API («simulador»)
//   SIM_WEBHOOK_URL   a dónde avisar mientras Auream no configure su webhook
//                     (http://localhost:3100/webhooks/uazapi)
//   SIM_DATA_DIR      dónde guarda su estado y los archivos (data/wa-sim)
//
// Solo desarrollo: no arranca con NODE_ENV=production ni en Vercel.
// ---------------------------------------------------------------------------

export interface SimulatorConfig {
  readonly port: number;
  readonly adminToken: string;
  readonly fallbackWebhookUrl: string;
  readonly dataDir: string;
  /** Dirección pública del simulador (los enlaces de los archivos). */
  readonly publicBase: string;
  /** Carpeta del teléfono de prueba (HTML, CSS y JS). */
  readonly uiDir: string;
}

export class SimulatorConfigError extends Error {}

export function loadSimulatorConfig(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): SimulatorConfig {
  if (env["NODE_ENV"] === "production" || env["VERCEL"]) {
    throw new SimulatorConfigError("El WhatsApp simulado es solo para desarrollo: no arranca en producción ni en Vercel.");
  }
  const port = Number(env["SIM_PORT"] ?? 3200);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new SimulatorConfigError(`SIM_PORT no es un puerto válido (llegó "${env["SIM_PORT"]}").`);
  return {
    port,
    adminToken: env["SIM_ADMIN_TOKEN"]?.trim() || "simulador",
    fallbackWebhookUrl: env["SIM_WEBHOOK_URL"]?.trim() || "http://localhost:3100/webhooks/uazapi",
    dataDir: env["SIM_DATA_DIR"]?.trim() || join(cwd, "data", "wa-sim"),
    publicBase: `http://localhost:${port}`,
    uiDir: join(cwd, "apps", "wa-sim", "phone", "ui")
  };
}
