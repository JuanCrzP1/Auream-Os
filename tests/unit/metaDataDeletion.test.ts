import { createHmac } from "node:crypto";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { readSignedRequest } from "../../domains/ads/application/MetaSignedRequest.js";
import { MetaDataDeletionService, type MetaDataDeletionStore } from "../../domains/ads/application/MetaDataDeletionService.js";
import { routeMetaDataDeletion } from "../../apps/api/routes/routeMetaDataDeletion.js";

// ---------------------------------------------------------------------------
// Lo que Meta exige a una app aprobada: si alguien quita Auream de su Facebook
// o pide borrar sus datos, Meta avisa con un `signed_request` firmado con el
// secreto de la app. Solo un aviso de Meta borra; queda un código para
// consultar, sin guardar quién es.
// ---------------------------------------------------------------------------

const SECRET = "secreto-de-la-app-auream-123";
const b64url = (value: Buffer | string) => Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function signed(payload: Record<string, unknown>, secret = SECRET): string {
  const data = b64url(JSON.stringify(payload));
  return `${b64url(createHmac("sha256", secret).update(data).digest())}.${data}`;
}

const NOTICE = { algorithm: "HMAC-SHA256", issued_at: 1794500000, user_id: "218471" };

function world() {
  const connections = new Map([["t-a", "218471"], ["t-b", "999"]]);
  const records: Array<{ code: string; userHash: string; deletedConnections: number }> = [];
  const store: MetaDataDeletionStore = {
    tenantsConnectedBy: async (userId) => [...connections].filter(([, owner]) => owner === userId).map(([tenant]) => tenant),
    record: async (entry) => void records.push(entry),
    find: async (code) => {
      const found = records.find((entry) => entry.code === code);
      return found ? { deletedConnections: found.deletedConnections, requestedAt: "2026-11-12T20:00:00.000Z" } : null;
    }
  };
  const service = new MetaDataDeletionService(SECRET, store, { removeConnection: async (tenantId) => void connections.delete(tenantId) }, "https://auream.app/eliminar-datos");
  return { service, connections, records };
}

describe("aviso firmado de Meta", () => {
  it("solo vale si lo firmó Meta con el secreto de esta app", () => {
    expect(readSignedRequest(signed(NOTICE), SECRET)).toEqual({ userId: "218471", issuedAt: 1794500000 });
    expect(readSignedRequest(signed(NOTICE, "otro-secreto"), SECRET)).toBeNull();
    const [signature] = signed(NOTICE).split(".");
    expect(readSignedRequest(`${signature}.${b64url(JSON.stringify({ ...NOTICE, user_id: "1" }))}`, SECRET)).toBeNull();
    expect(readSignedRequest(signed({ ...NOTICE, algorithm: "none" }), SECRET)).toBeNull();
    expect(readSignedRequest(signed({ ...NOTICE, user_id: "../x" }), SECRET)).toBeNull();
    expect([readSignedRequest("basura", SECRET), readSignedRequest(undefined, SECRET), readSignedRequest("a.b.c", SECRET)]).toEqual([null, null, null]);
  });
});

describe("borrar los datos de quien lo pide desde Facebook", () => {
  it("borra su conexión de Meta Ads, deja un código para consultar y no guarda quién es", async () => {
    const w = world();
    const receipt = await w.service.requestDeletion(signed(NOTICE));
    expect(receipt.confirmation_code).toMatch(/^[A-Z2-9]{12}$/);
    expect(receipt.url).toBe(`https://auream.app/eliminar-datos?codigo=${receipt.confirmation_code}`);
    expect([...w.connections.keys()]).toEqual(["t-b"]);
    expect(w.records[0]!.userHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(w.records)).not.toContain("218471");
    expect(await w.service.status(receipt.confirmation_code.toLowerCase())).toEqual({ code: receipt.confirmation_code, status: "completed", requestedAt: "2026-11-12T20:00:00.000Z", deletedConnections: 1 });
    await expect(w.service.status("NOEXISTE2345")).rejects.toThrow("No encontramos");
    await expect(w.service.status("<script>")).rejects.toThrow("No encontramos");
  });

  it("quitar la app borra su conexión; un aviso falso no borra nada", async () => {
    const w = world();
    await expect(w.service.deauthorize(signed(NOTICE, "falso"))).rejects.toThrow("no es válida");
    expect(w.connections.size).toBe(2);
    await w.service.deauthorize(signed({ ...NOTICE, user_id: "999" }));
    expect([...w.connections.keys()]).toEqual(["t-a"]);
  });

  it("por HTTP: Meta manda un formulario y recibe { url, confirmation_code }; sin la app de Meta, 503", async () => {
    const w = world();
    const call = async (method: string, path: string, body?: string, service: MetaDataDeletionService | null = w.service) => {
      const request = Object.assign(Readable.from(body ? [Buffer.from(body)] : []), { method, url: path, headers: { "content-type": "application/x-www-form-urlencoded" }, socket: { remoteAddress: "1.1.1.1" } }) as unknown as IncomingMessage;
      const out = { statusCode: 0, body: "", headers: {} as Record<string, string>, setHeader(k: string, v: string) { out.headers[k] = v; }, end(chunk?: string) { out.body = chunk ?? ""; } };
      const handled = await routeMetaDataDeletion(request, out as never, new URL(`http://x${path}`), service, undefined);
      return { handled, status: out.statusCode, json: out.body ? (JSON.parse(out.body) as Record<string, unknown>) : null };
    };
    const created = await call("POST", "/meta/data-deletion", `signed_request=${encodeURIComponent(signed(NOTICE))}`);
    expect(created.status).toBe(200);
    expect(created.json).toMatchObject({ url: expect.stringContaining("/eliminar-datos?codigo="), confirmation_code: expect.stringMatching(/^[A-Z2-9]{12}$/) });
    const status = await call("GET", `/meta/data-deletion/${String(created.json!["confirmation_code"])}`);
    expect(status.json).toMatchObject({ status: "completed", deletedConnections: 1 });
    expect((await call("POST", "/meta/deauthorize", "signed_request=x", null)).status).toBe(503);
    expect((await call("GET", "/meta/deauthorize")).handled).toBe(false);
  });
});
