import { createServer, type Server } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join, normalize } from "node:path";
import type { SimulatorConfig } from "./config";
import { Simulator } from "./core/Simulator";
import { SimulatorStore } from "./core/SimulatorStore";
import { Router, sendJson } from "./http/http";
import { registerPhoneApi } from "./phone/phoneApi";
import { SimFiles } from "./phone/SimFiles";
import { registerGroupApi } from "./provider/groupApi";
import { registerInstanceApi } from "./provider/instanceApi";
import { registerMessageApi } from "./provider/messageApi";
import { AureamClock } from "./webhooks/AureamClock";
import { AureamNotifier } from "./webhooks/AureamNotifier";

// ---------------------------------------------------------------------------
// Arma el WhatsApp simulado: el estado, la API que imita a uazapi, la del
// teléfono de prueba, los archivos y la pantalla (`phone/ui`). Separado de
// `main.ts` para que las pruebas lo levanten en un puerto cualquiera.
// ---------------------------------------------------------------------------

export interface SimulatorApp {
  readonly server: Server;
  readonly simulator: Simulator;
  readonly store: SimulatorStore;
}

const UI_TYPES: Readonly<Record<string, string>> = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };

export function createSimulatorApp(config: SimulatorConfig, options: { readonly persist?: boolean; readonly deliveryDelayMs?: number; readonly fetch?: typeof fetch } = {}): SimulatorApp {
  const store = new SimulatorStore(options.persist === false ? null : join(config.dataDir, "state.json"));
  const notifier = new AureamNotifier(store, config.fallbackWebhookUrl, options.fetch);
  const simulator = new Simulator(store, notifier, options.deliveryDelayMs);
  const files = new SimFiles(join(config.dataDir, "files"), config.publicBase);

  const router = new Router();
  registerInstanceApi(router, simulator, config.adminToken);
  registerMessageApi(router, simulator);
  registerGroupApi(router, simulator);
  registerPhoneApi(router, simulator, notifier, files, new AureamClock(store, config.fallbackWebhookUrl, options.fetch));

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", config.publicBase);
    void (async () => {
      try {
        if (await router.handle(request, response, url)) return;
        if (request.method === "GET" && url.pathname.startsWith("/_sim/files/")) {
          const file = files.read(url.pathname.slice("/_sim/files/".length));
          if (!file) return sendJson(response, 404, { error: "file not found" });
          response.setHeader("content-type", file.mimeType);
          response.end(file.bytes);
          return;
        }
        if (request.method === "GET") {
          // El teléfono de prueba: archivos estáticos de `phone/ui` (nada fuera de esa carpeta).
          const name = url.pathname === "/" ? "index.html" : normalize(url.pathname).replace(/^[/\\]+/, "");
          const path = join(config.uiDir, name);
          const type = UI_TYPES[name.slice(name.lastIndexOf("."))];
          if (type && path.startsWith(config.uiDir) && existsSync(path)) {
            response.setHeader("content-type", type);
            response.end(readFileSync(path));
            return;
          }
        }
        sendJson(response, 404, { error: "Not found" });
      } catch (error) {
        store.record("in", `error: ${error instanceof Error ? error.message : "desconocido"}`, false);
        if (!response.headersSent) sendJson(response, 500, { error: "simulator error" });
      }
    })();
  });

  return { server, simulator, store };
}
