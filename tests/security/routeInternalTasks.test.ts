import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage } from "node:http";
import { routeInternalTasks } from "../../apps/api/routes/routeInternalTasks.js";
import type { TaskRunner } from "../../domains/scheduling/application/TaskRunner.js";
import { loadApiConfig } from "../../apps/api/config/loadApiConfig.js";

// ---------------------------------------------------------------------------
// `/internal/tasks/run` no es de usuarios: solo con `Authorization: Bearer
// <CRON_SECRET>` (como lo envía Vercel Cron). Sin la clave configurada no
// atiende a nadie. Responde enseguida y la ronda sigue en segundo plano.
// ---------------------------------------------------------------------------

const SECRET = "c".repeat(40);
const req = (method: string, authorization?: string) =>
  ({ method, url: "/internal/tasks/run", headers: authorization ? { authorization } : {} }) as unknown as IncomingMessage;
function recorder() {
  const response = { statusCode: 0, body: "", setHeader() {}, end(chunk?: string) { response.body = chunk ?? ""; } };
  return response;
}

function setup(cronSecret: string | null) {
  const runner = { run: vi.fn(async () => ({ claimed: 0, completed: 0, retried: 0, failed: 0, purged: 0, durationMs: 1 })) } as unknown as TaskRunner;
  const jobs: Array<() => Promise<unknown>> = [];
  const continueIfSoon = vi.fn(async () => true);
  const deps = { runner, cronSecret, budgetMs: 50_000, background: { run: (job: () => Promise<unknown>) => void jobs.push(job) }, chain: { horizonMs: 900_000, continueIfSoon } };
  const call = async (method: string, authorization?: string, path = "/internal/tasks/run") => {
    const response = recorder();
    const handled = await routeInternalTasks(req(method, authorization), response as never, new URL(`http://x${path}`), deps);
    return { handled, status: response.statusCode };
  };
  return { runner, jobs, call, continueIfSoon };
}

describe("routeInternalTasks", () => {
  it("con la clave correcta despierta al trabajador (202), la ronda corre en segundo plano y luego sigue la cadena", async () => {
    const s = setup(SECRET);
    expect(await s.call("GET", `Bearer ${SECRET}`)).toEqual({ handled: true, status: 202 });
    await Promise.all(s.jobs.map((job) => job()));
    expect(s.runner.run).toHaveBeenCalledWith({ budgetMs: 50_000, holdWithinMs: 900_000 });
    expect(s.continueIfSoon).toHaveBeenCalledWith(900_000);
  });

  it("sin clave, con otra clave o con otro esquema: 401, y no corre nada", async () => {
    const s = setup(SECRET);
    for (const header of [undefined, `Bearer ${"x".repeat(40)}`, SECRET, `Basic ${SECRET}`, `Bearer ${SECRET} `]) {
      expect((await s.call("POST", header)).status).toBe(401);
    }
    expect(s.jobs).toHaveLength(0);
  });

  it("sin CRON_SECRET configurado no atiende a nadie (503); otras rutas y métodos no son suyos", async () => {
    expect((await setup(null).call("GET", `Bearer ${SECRET}`)).status).toBe(503);
    expect((await setup(SECRET).call("DELETE", `Bearer ${SECRET}`)).status).toBe(405);
    expect((await setup(SECRET).call("GET", `Bearer ${SECRET}`, "/internal/otra")).handled).toBe(false);
  });

  it("la configuración exige una clave larga y solo despierta por HTTP en producción con clave", () => {
    const base = { JWT_SECRET: "x".repeat(32), DEV_API_KEY: "bfk_clave-local" };
    expect(() => loadApiConfig({ ...base, CRON_SECRET: "corta" })).toThrow(/al menos 16/);
    expect(loadApiConfig(base).tasks).toEqual({ cronSecret: null, selfBaseUrl: null, runnerBudgetMs: 50_000, chainHorizonMs: 900_000 });
    expect(loadApiConfig({ ...base, TASK_CHAIN_HORIZON_MS: "0" }).tasks.chainHorizonMs).toBe(0);
    expect(loadApiConfig({ ...base, CRON_SECRET: SECRET, VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "auream-os.vercel.app" }).tasks).toEqual({
      cronSecret: SECRET,
      selfBaseUrl: "https://auream-os.vercel.app/api",
      runnerBudgetMs: 50_000,
      chainHorizonMs: 900_000
    });
  });
});
