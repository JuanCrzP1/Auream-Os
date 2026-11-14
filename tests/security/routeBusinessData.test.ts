import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeBusinessDataRequest } from "../../apps/api/routes/routeBusinessDataRequest.js";
import { BusinessDataServices } from "../../domains/business-data/application/BusinessDataServices.js";
import { InMemoryBusinessDataRepository } from "../../infrastructure/persistence/memory/InMemoryBusinessData.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { ROLE_SCOPES } from "../../platform/authorization/roles/RoleDefinitions.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// Datos del negocio por HTTP: cambiar uno cambia lo que dicen los flujos, así
// que lo hacen quienes editan automatizaciones (dueños y administradores). El
// Asesor los ve y lee sus valores (los pone en sus respuestas rápidas). Cada
// cuenta solo toca los suyos.
// ---------------------------------------------------------------------------

const req = (method: string, path: string, body?: unknown) =>
  Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: { "content-type": "application/json" }, socket: { remoteAddress: "1.2.3.4" } }) as unknown as IncomingMessage;
const res = () => {
  const r = { statusCode: 0, body: "", headers: {} as Record<string, string>, setHeader(k: string, v: string) { r.headers[k] = v; }, end(chunk?: string) { r.body = chunk ?? ""; } };
  return r;
};

async function run(services: BusinessDataServices | undefined, method: string, path: string, role: keyof typeof ROLE_SCOPES, tenantId = "tenant-a", body?: unknown) {
  const r = res();
  await routeBusinessDataRequest(req(method, path, body), r as never, new URL(`http://x${path}`), services, makeContext({ scopes: [...ROLE_SCOPES[role]], tenantId, actorId: "user-a" }));
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : null };
}

function services(): BusinessDataServices {
  let n = 0;
  const flows = [{ flow: { key: "ventas", name: "Ventas" }, nodes: { pago: { id: "pago", name: "Pago", type: "message", content: {}, config: { items: [{ kind: "text", text: "Paga al {g_pago_movil}" }] } } } }];
  const texts = { flows: async (tenantId: string) => (tenantId === "tenant-a" ? flows : []) as never, broadcasts: async () => [], quickReplies: async () => [] };
  return new BusinessDataServices(new InMemoryBusinessDataRepository(), texts, { forget: () => undefined }, { newId: () => `aaaaaaaa-0000-4000-8000-00000000000${++n}` });
}

describe("/business-data", () => {
  it("dueños y administradores los crean y cambian; el Asesor los ve y lee los valores, sin cambiarlos", async () => {
    const data = services();
    const created = await run(data, "POST", "/business-data", "tenant_owner", "tenant-a", { label: "Pago Móvil", type: "text", value: "0424-6461556" });
    expect(created).toMatchObject({ status: 201, body: { key: "g_pago_movil", value: "0424-6461556" } });
    const id = created.body.id as string;
    expect((await run(data, "PATCH", `/business-data/${id}`, "tenant_admin", "tenant-a", { value: "0414-0000000" })).body).toMatchObject({ value: "0414-0000000" });

    expect(await run(data, "GET", "/business-data", "operator")).toMatchObject({ status: 200, body: { canManage: false, data: [{ key: "g_pago_movil", uses: [{ kind: "flow" }] }] } });
    expect((await run(data, "GET", "/business-data/values", "operator")).body).toEqual({ values: { g_pago_movil: "0414-0000000" } });
    await expect(run(data, "PATCH", `/business-data/${id}`, "operator", "tenant-a", { value: "otro" })).rejects.toBeInstanceOf(AccessError);
    await expect(run(data, "POST", "/business-data", "viewer", "tenant-a", { label: "X", type: "text", value: "x" })).rejects.toBeInstanceOf(AccessError);
  });

  it("borrar uno que se usa pide escribir su clave", async () => {
    const data = services();
    const id = (await run(data, "POST", "/business-data", "tenant_owner", "tenant-a", { label: "Pago Móvil", type: "text", value: "0424" })).body.id as string;
    await expect(run(data, "DELETE", `/business-data/${id}`, "tenant_owner")).rejects.toThrow("Para borrarlo escribe «g_pago_movil»");
    expect((await run(data, "DELETE", `/business-data/${id}?confirm=g_pago_movil`, "tenant_owner")).status).toBe(204);
  });

  it("otra cuenta no ve, no lee ni cambia los datos de esta", async () => {
    const data = services();
    const id = (await run(data, "POST", "/business-data", "tenant_owner", "tenant-a", { label: "Horario", type: "text", value: "8 a 6" })).body.id as string;
    expect((await run(data, "GET", "/business-data", "tenant_owner", "tenant-b")).body.data).toEqual([]);
    expect((await run(data, "GET", "/business-data/values", "tenant_owner", "tenant-b")).body).toEqual({ values: {} });
    await expect(run(data, "PATCH", `/business-data/${id}`, "tenant_owner", "tenant-b", { value: "robado" })).rejects.toThrow("Ese dato ya no existe.");
    await expect(run(data, "DELETE", `/business-data/${id}?confirm=g_horario`, "tenant_owner", "tenant-b")).rejects.toThrow("Ese dato ya no existe.");
    expect((await run(data, "GET", "/business-data/values", "tenant_owner", "tenant-a")).body).toEqual({ values: { g_horario: "8 a 6" } });
  });

  it("programar y quitar cambios: dueños y administradores; el historial lo ve quien ve los datos; otra cuenta, nada", async () => {
    const data = services();
    const id = (await run(data, "POST", "/business-data", "tenant_owner", "tenant-a", { label: "Horario", type: "text", value: "8 a 6" })).body.id as string;
    const body = { value: "Cerrado", from: { date: "2099-12-24", time: "08:00" }, until: { date: "2099-12-26", time: "08:00" }, note: "Navidad" };
    await expect(run(data, "POST", `/business-data/${id}/schedules`, "operator", "tenant-a", body)).rejects.toBeInstanceOf(AccessError);
    await expect(run(data, "POST", `/business-data/${id}/schedules`, "tenant_owner", "tenant-b", body)).rejects.toThrow("Ese dato ya no existe.");
    await expect(run(data, "GET", `/business-data/${id}/history`, "tenant_owner", "tenant-b")).rejects.toThrow("Ese dato ya no existe.");
    // «Hasta un año adelante»: este va muy lejos.
    await expect(run(data, "POST", `/business-data/${id}/schedules`, "tenant_admin", "tenant-a", body)).rejects.toThrow("hasta un año adelante");

    const soon = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const later = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const scheduled = await run(data, "POST", `/business-data/${id}/schedules`, "tenant_admin", "tenant-a", { ...body, from: { date: soon, time: "08:00" }, until: { date: later, time: "08:00" } });
    expect(scheduled).toMatchObject({ status: 201, body: { schedules: [{ value: "Cerrado", note: "Navidad" }] } });
    const sid = scheduled.body.schedules[0].id as string;
    await expect(run(data, "PATCH", `/business-data/${id}/schedules/${sid}`, "operator", "tenant-a", { note: "x" })).rejects.toBeInstanceOf(AccessError);
    await expect(run(data, "DELETE", `/business-data/${id}/schedules/${sid}`, "tenant_owner", "tenant-b")).rejects.toThrow("Ese dato ya no existe.");
    expect((await run(data, "PATCH", `/business-data/${id}/schedules/${sid}`, "tenant_owner", "tenant-a", { note: "Navidad 2026" })).body.schedules[0]).toMatchObject({ note: "Navidad 2026" });

    const history = await run(data, "GET", `/business-data/${id}/history`, "operator", "tenant-a");
    expect(history.body.changes.map((change: { kind: string }) => change.kind)).toEqual(["rescheduled", "scheduled", "created"]);
    expect((await run(data, "DELETE", `/business-data/${id}/schedules/${sid}`, "tenant_owner", "tenant-a")).body.schedules).toEqual([]);
  });

  it("sin el módulo responde 503", async () => {
    expect((await run(undefined, "GET", "/business-data", "tenant_owner")).status).toBe(503);
  });
});
