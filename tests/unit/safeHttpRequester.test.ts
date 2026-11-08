import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { gzipSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import { SafeHttpRequester } from "../../infrastructure/http/SafeHttpRequester.js";

// ---------------------------------------------------------------------------
// Cliente HTTP de las integraciones contra servidores locales reales: la
// protección SSRF por defecto, y con la red privada permitida (solo
// desarrollo), redirecciones, plazos, tamaños y compresión.
// ---------------------------------------------------------------------------

type Handler = (req: IncomingMessage, res: ServerResponse, body: string) => void;

function serve(handler: Handler): Promise<{ server: Server; base: string }> {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => handler(req, res, body));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })));
}

let main: { server: Server; base: string };
let other: { server: Server; base: string };

beforeAll(async () => {
  other = await serve((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ method: req.method, auth: req.headers.authorization ?? null }));
  });
  main = await serve((req, res, body) => {
    const url = new URL(req.url!, "http://x");
    switch (url.pathname) {
      case "/echo":
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ method: req.method, body, contentType: req.headers["content-type"] ?? null, ua: req.headers["user-agent"] }));
        return;
      case "/see-other":
        res.writeHead(303, { location: "/echo" }).end();
        return;
      case "/cross":
        res.writeHead(307, { location: `${other.base}/x` }).end();
        return;
      case "/loop":
        res.writeHead(302, { location: "/loop" }).end();
        return;
      case "/slow":
        setTimeout(() => res.end("tarde"), 500);
        return;
      case "/big":
        res.end("x".repeat(2048));
        return;
      case "/gzip":
        res.writeHead(200, { "content-encoding": "gzip", "content-type": "application/json" }).end(gzipSync(JSON.stringify({ ok: true })));
        return;
      default:
        res.writeHead(404).end("no");
    }
  });
});

afterAll(() => {
  main.server.close();
  other.server.close();
});

const open = new SafeHttpRequester({ allowPrivateNetworks: true, maxResponseBytes: 1024 });
const req = (url: string, extra: Partial<{ method: string; headers: Record<string, string>; body: string; timeoutMs: number }> = {}) => ({
  method: "GET",
  url,
  headers: {},
  timeoutMs: 2000,
  ...extra
});

describe("protección SSRF (por defecto)", () => {
  const strict = new SafeHttpRequester();

  it.each([
    ["una IP privada escrita en la URL", () => `${main.base}/echo`],
    ["localhost (resuelve a loopback)", () => main.base.replace("127.0.0.1", "localhost") + "/echo"],
    ["la IP de metadatos de la nube", () => "http://169.254.169.254/latest/meta-data"],
    ["IPv6 loopback", () => "http://[::1]:80/"]
  ])("bloquea %s", async (_case, url) => {
    const result = await strict.send(req(url()));
    expect(result.ok ? null : result.reason).toBe("blocked_destination");
  });

  it("solo http y https", async () => {
    const result = await strict.send(req("file:///etc/passwd"));
    expect(result.ok ? null : result.reason).toBe("blocked_destination");
  });
});

describe("con la red privada permitida (desarrollo)", () => {
  it("envía método, cuerpo y cabeceras, y lee la respuesta", async () => {
    const result = await open.send(req(`${main.base}/echo`, { method: "POST", headers: { "content-type": "application/json", "user-agent": "t/1" }, body: '{"a":1}' }));
    expect(result.ok && result.response.status).toBe(200);
    expect(result.ok && JSON.parse(result.response.body)).toEqual({ method: "POST", body: '{"a":1}', contentType: "application/json", ua: "t/1" });
  });

  it("303 continúa como GET sin cuerpo", async () => {
    const result = await open.send(req(`${main.base}/see-other`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));
    expect(result.ok && JSON.parse(result.response.body)).toMatchObject({ method: "GET", body: "", contentType: null });
  });

  it("al cambiar de origen no viaja Authorization", async () => {
    const result = await open.send(req(`${main.base}/cross`, { headers: { authorization: "Bearer secreto" } }));
    expect(result.ok && JSON.parse(result.response.body)).toEqual({ method: "GET", auth: null });
  });

  it("corta las redirecciones infinitas", async () => {
    const result = await open.send(req(`${main.base}/loop`));
    expect(result.ok ? null : result.reason).toBe("too_many_redirects");
  });

  it("respeta el plazo", async () => {
    const result = await open.send(req(`${main.base}/slow`, { timeoutMs: 100 }));
    expect(result.ok ? null : result.reason).toBe("timeout");
  });

  it("corta respuestas demasiado grandes", async () => {
    const result = await open.send(req(`${main.base}/big`));
    expect(result.ok ? null : result.reason).toBe("response_too_large");
  });

  it("descomprime gzip", async () => {
    const result = await open.send(req(`${main.base}/gzip`));
    expect(result.ok && JSON.parse(result.response.body)).toEqual({ ok: true });
  });

  it("un 404 es una respuesta, no un error de red", async () => {
    const result = await open.send(req(`${main.base}/nada`));
    expect(result.ok && result.response.status).toBe(404);
  });

  // Depende del DNS del equipo: plazo holgado para que una red lenta no lo vuelva intermitente.
  it("dominio inexistente → network_error legible", async () => {
    const result = await open.send(req("http://no-existe.invalid/", { timeoutMs: 15_000 }));
    expect(result.ok ? null : [result.reason, result.message]).toEqual(["network_error", "No se encontró el dominio."]);
  }, 20_000);
});
