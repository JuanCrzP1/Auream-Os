import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueueClient } from "@vercel/queue";
import { composeTaskAlarmConsumer } from "../../apps/api/bootstrap/composeTaskAlarmConsumer.js";
import { webHandlerOnNode } from "../../apps/api/http/webHandlerOnNode.js";
import { TASK_ALARM_TOPIC } from "../../infrastructure/scheduling/VercelQueueTaskAlarm.js";

// ---------------------------------------------------------------------------
// El consumidor de los despertadores tal como lo invoca Vercel Queues: una
// entrega en modo binario (v2beta) a una función `(req, res)` SIN las ayudas
// de Vercel (el proyecto tiene `NODEJS_HELPERS=0`). Con `handleNodeCallback`
// cada entrega fallaba sin despertar a nadie: los intervalos solo seguían si
// otra cosa despertaba la cola.
// ---------------------------------------------------------------------------

const SECRET = "s".repeat(32);
const ENV = { VERCEL: "1", VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "auream-os.vercel.app", CRON_SECRET: SECRET } as NodeJS.ProcessEnv;
const RUN_URL = "https://auream-os.vercel.app/api/internal/tasks/run";

const servers: http.Server[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.close();
  vi.restoreAllMocks();
});

/** Un servidor de Node sin ayudas de Vercel, como la función en producción. */
async function listen(listener: (req: http.IncomingMessage, res: http.ServerResponse) => unknown): Promise<string> {
  const server = http.createServer((req, res) => void listener(req, res));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** La API de Vercel Queues: el consumidor solo la usa para confirmar el aviso. */
async function fakeQueueApi() {
  const calls: string[] = [];
  const url = await listen((req, res) => {
    calls.push(`${req.method} ${req.url}`);
    res.statusCode = 204;
    res.end();
  });
  return { calls, client: new QueueClient({ token: "t", region: "cle1", deploymentId: null, resolveBaseUrl: () => new URL(url) }) };
}

function deliver(consumerUrl: string, topic: string = TASK_ALARM_TOPIC) {
  return fetch(`${consumerUrl}/api/task-alarm`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "ce-type": "com.vercel.queue.v2beta",
      "ce-vqsqueuename": topic,
      "ce-vqsconsumergroup": "api-task-alarm",
      "ce-vqsmessageid": "msg-1",
      "ce-vqsreceipthandle": "receipt-1",
      "ce-vqsregion": "cle1",
      "ce-vqsdeliverycount": "1"
    },
    body: JSON.stringify({ at: "2026-11-09T12:03:01.000Z" })
  });
}

describe("consumidor de los despertadores (entrega real de Vercel Queues)", () => {
  it("despierta al trabajador de producción con la clave, confirma el aviso y anota cuánto tardó la entrega", async () => {
    const logs = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const queue = await fakeQueueApi();
    const worker = vi.fn(async () => new Response(null, { status: 202 }));
    const consumer = await listen(composeTaskAlarmConsumer(queue.client, ENV, worker as unknown as typeof fetch));

    const response = await deliver(consumer);

    expect(response.status).toBe(200);
    expect(worker).toHaveBeenCalledTimes(1);
    expect(worker).toHaveBeenCalledWith(RUN_URL, expect.objectContaining({ method: "POST", headers: { authorization: `Bearer ${SECRET}` } }));
    expect(queue.calls).toEqual([`DELETE /api/v3/topic/${TASK_ALARM_TOPIC}/consumer/api-task-alarm/lease/receipt-1`]);
    const rang = JSON.parse(String(logs.mock.calls[0]?.[0])) as { event: string; lateMs: number; delivery: number };
    expect(rang).toMatchObject({ event: "tasks.alarm_rang", delivery: 1 });
    expect(typeof rang.lateMs).toBe("number");
  });

  it("si el trabajador no responde bien, no confirma el aviso: Vercel Queues lo reintenta", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const queue = await fakeQueueApi();
    const worker = vi.fn(async () => new Response(null, { status: 503 }));
    const consumer = await listen(composeTaskAlarmConsumer(queue.client, ENV, worker as unknown as typeof fetch));

    const response = await deliver(consumer);

    expect(response.status).toBe(500);
    expect(queue.calls.filter((call) => call.startsWith("DELETE"))).toEqual([]);
  });

  it("sin clave o sin dirección de producción no despierta a nadie (reintentar no lo arregla) y confirma el aviso", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const queue = await fakeQueueApi();
    const worker = vi.fn(async () => new Response(null, { status: 202 }));
    const consumer = await listen(composeTaskAlarmConsumer(queue.client, { ...ENV, CRON_SECRET: "" }, worker as unknown as typeof fetch));

    expect((await deliver(consumer)).status).toBe(200);
    expect(worker).not.toHaveBeenCalled();
    expect(queue.calls).toHaveLength(1);
  });
});

describe("webHandlerOnNode", () => {
  it("pasa método, dirección, cabeceras y cuerpo crudo al manejador web, y devuelve su respuesta tal cual", async () => {
    const seen: Array<{ method: string; url: string; header: string | null; body: string }> = [];
    const url = await listen(
      webHandlerOnNode(async (request) => {
        seen.push({ method: request.method, url: new URL(request.url).pathname + new URL(request.url).search, header: request.headers.get("x-prueba"), body: await request.text() });
        return Response.json({ ok: true }, { status: 201, headers: { "x-respuesta": "1" } });
      })
    );
    const response = await fetch(`${url}/ruta?a=1`, { method: "POST", headers: { "x-prueba": "hola", "content-type": "text/plain" }, body: "cuerpo" });
    expect([response.status, response.headers.get("x-respuesta"), await response.json()]).toEqual([201, "1", { ok: true }]);
    expect(seen).toEqual([{ method: "POST", url: "/ruta?a=1", header: "hola", body: "cuerpo" }]);
  });

  it("corta un cuerpo demasiado grande sin llamar al manejador", async () => {
    const handler = vi.fn(async () => new Response("no"));
    const url = await listen(webHandlerOnNode(handler, 8));
    expect((await fetch(url, { method: "POST", body: "x".repeat(64) })).status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
  });
});
