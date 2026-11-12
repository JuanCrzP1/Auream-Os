import { ApiConfigError } from "./ApiConfigError";

// ---------------------------------------------------------------------------
// El WhatsApp simulado (`apps/wa-sim`): un servidor local que se hace pasar
// por uazapi para probar Auream de punta a punta sin celulares.
//
//   WHATSAPP_SIMULATOR_URL     http://localhost:3200 (solo localhost)
//   WHATSAPP_SIMULATOR_TOKEN   el «admintoken» del simulador (por defecto
//                              «simulador»)
//
// Con el simulador, Auream le habla a él en vez de a uazapi y le pide que
// avise a esta misma API. NUNCA en producción ni en Vercel: la API se niega
// a arrancar (un número de clientes reales no puede caer en un simulador).
// ---------------------------------------------------------------------------

export interface WhatsAppSimulatorConfig {
  readonly baseUrl: string;
  readonly adminToken: string;
}

const LOCAL_URL = /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/;

export function loadWhatsAppSimulator(env: NodeJS.ProcessEnv, isProduction: boolean): WhatsAppSimulatorConfig | null {
  const url = env["WHATSAPP_SIMULATOR_URL"]?.trim().replace(/\/+$/, "") || "";
  if (!url) return null;
  if (isProduction || env["VERCEL"]) {
    throw new ApiConfigError("WHATSAPP_SIMULATOR_URL es solo para desarrollo: quítalo de producción (los números reales no pueden ir al simulador).");
  }
  if (!LOCAL_URL.test(url)) {
    throw new ApiConfigError(`WHATSAPP_SIMULATOR_URL debe ser una dirección local, p. ej. http://localhost:3200 (llegó "${url}").`);
  }
  return { baseUrl: url, adminToken: env["WHATSAPP_SIMULATOR_TOKEN"]?.trim() || "simulador" };
}
