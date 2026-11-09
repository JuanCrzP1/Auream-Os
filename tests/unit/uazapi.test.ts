import { describe, expect, it, vi } from "vitest";
import { UazapiClient, UazapiError, type FetchLike } from "../../infrastructure/whatsapp/uazapi/UazapiClient.js";
import { instanceNameFor, UazapiLinker } from "../../infrastructure/whatsapp/uazapi/UazapiLinker.js";
import { LinkerError } from "../../domains/connections/application/ports/WhatsAppLinker.js";

// ---------------------------------------------------------------------------
// Cliente de uazapi contra un servidor falso con las respuestas de su
// documentación (docs.uazapi.com): crear instancia, QR, estado, borrar y
// avisos; los tokens van en cabeceras y nunca en la URL.
// ---------------------------------------------------------------------------

const BASE = "https://auream.uazapi.com";
const ADMIN = "admin-token-secreto";
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

interface Call {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: Record<string, unknown> | null;
}

function server(routes: Record<string, (call: Call) => Response>) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = vi.fn(async (input: string, init?: RequestInit) => {
    const call: Call = {
      method: init?.method ?? "GET",
      url: input,
      headers: init?.headers as Record<string, string>,
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
    };
    calls.push(call);
    const route = routes[`${call.method} ${new URL(input).pathname}`];
    return route ? route(call) : json(404, { error: "Instância não encontrada" });
  });
  return { calls, client: new UazapiClient({ baseUrl: `${BASE}/`, adminToken: ADMIN }, fetchImpl) };
}

const created = () => json(200, { response: "Instance created successfully", instance: { id: "r1a2b3", token: "inst-token", name: "auream-c1", status: "disconnected" }, token: "inst-token" });
const connecting = (qrcode = "data:image/png;base64,iVBORw0KGgo") => json(200, { connected: false, loggedIn: false, jid: null, instance: { id: "r1a2b3", status: "connecting", qrcode }, response: "Connecting" });
const online = () => json(200, { instance: { id: "r1a2b3", status: "connected", profileName: "Dilo Cantando", qrcode: "" }, status: { connected: true, loggedIn: true, jid: { user: "573013815302", agent: 0, device: 0, server: "s.whatsapp.net" } } });

describe("UazapiClient", () => {
  it("crea la instancia con admintoken en la cabecera y devuelve su id y token", async () => {
    const api = server({ "POST /instance/create": created });
    expect(await api.client.createInstance("auream-c1", "Auream")).toEqual({ id: "r1a2b3", token: "inst-token" });
    const call = api.calls[0]!;
    expect(call.url).toBe(`${BASE}/instance/create`);
    expect(call.headers["admintoken"]).toBe(ADMIN);
    expect(call.body).toEqual({ name: "auream-c1", systemName: "Auream" });
    expect(call.url).not.toContain(ADMIN);
  });

  it("el QR llega como data URL; si viene sin prefijo, se lo pone", async () => {
    const api = server({ "POST /instance/connect": () => connecting("iVBORw0KGgo") });
    expect((await api.client.connect("inst-token")).qrcode).toBe("data:image/png;base64,iVBORw0KGgo");
    expect(api.calls[0]!.headers["token"]).toBe("inst-token");
  });

  it("si ya hay una conexión en curso (409), devuelve el estado con su QR", async () => {
    const api = server({ "POST /instance/connect": () => json(409, { error: "connection in progress" }), "GET /instance/status": () => connecting() });
    expect((await api.client.connect("inst-token")).status).toBe("connecting");
  });

  it("el estado trae el número (jid.user) y el perfil", async () => {
    const api = server({ "GET /instance/status": online });
    expect(await api.client.status("inst-token")).toMatchObject({ status: "connected", phoneNumber: "573013815302", profileName: "Dilo Cantando" });
  });

  it("borrar una instancia que ya no existe no es un error", async () => {
    const api = server({});
    await expect(api.client.deleteInstance("inst-token")).resolves.toBeUndefined();
  });

  it("traduce los fallos y nunca repite el token", async () => {
    const api = server({
      "POST /instance/create": () => json(401, { error: "Unauthorized" }),
      "GET /instance/status": () => json(503, { error: "x" })
    });
    await expect(api.client.createInstance("a", "b")).rejects.toMatchObject({ reason: "unauthorized" });
    const failure = await api.client.status("inst-token").catch((error: UazapiError) => error);
    expect(failure).toMatchObject({ reason: "unavailable" });
    expect(String((failure as Error).message)).not.toContain("inst-token");
  });
});

describe("UazapiLinker", () => {
  it("sesión nueva: crea la instancia con el nombre de la conexión, registra el aviso y devuelve el QR", async () => {
    const api = server({ "POST /instance/create": created, "POST /webhook": () => json(200, []), "POST /instance/connect": () => connecting() });
    const linker = new UazapiLinker(api.client, "https://auream-os.vercel.app/api/webhooks/uazapi");
    const outcome = await linker.start({ id: "c1", tenantId: "t", name: "Ventas", method: "qr" }, null);
    expect(outcome).toMatchObject({ kind: "qr", qrImage: "data:image/png;base64,iVBORw0KGgo", session: { ref: "r1a2b3", secret: "inst-token" } });
    expect(api.calls[0]!.body).toMatchObject({ name: instanceNameFor("c1") });
    expect(api.calls[1]!.body).toEqual({ enabled: true, url: "https://auream-os.vercel.app/api/webhooks/uazapi", events: ["connection"], excludeMessages: ["wasSentByApi"] });
  });

  it("sin URL pública (desarrollo) no registra avisos", async () => {
    const api = server({ "POST /instance/create": created, "POST /instance/connect": () => connecting() });
    await new UazapiLinker(api.client, null).start({ id: "c1", tenantId: "t", name: "Ventas", method: "qr" }, null);
    expect(api.calls.map((c) => new URL(c.url).pathname)).toEqual(["/instance/create", "/instance/connect"]);
  });

  it("si la sesión guardada ya no existe en uazapi, crea otra", async () => {
    let first = true;
    const api = server({
      "POST /instance/connect": () => (first ? ((first = false), json(401, { error: "Invalid token" })) : connecting()),
      "POST /instance/create": created
    });
    const outcome = await new UazapiLinker(api.client, null).start({ id: "c1", tenantId: "t", name: "Ventas", method: "qr" }, { ref: "viejo", secret: "token-viejo" });
    expect(outcome).toMatchObject({ kind: "qr", session: { ref: "r1a2b3" } });
  });

  it("consultar: conectada con número; sin instancia, desconectada; uazapi caído, error", async () => {
    const linker = (route: () => Response) => new UazapiLinker(server({ "GET /instance/status": route }).client, null);
    expect(await linker(online).check({ ref: "r", secret: "t" })).toEqual({ kind: "connected", phoneNumber: "573013815302", profileName: "Dilo Cantando" });
    expect(await linker(() => json(404, {})).check({ ref: "r", secret: "t" })).toEqual({ kind: "disconnected" });
    await expect(linker(() => json(500, {})).check({ ref: "r", secret: "t" })).rejects.toThrow(LinkerError);
  });

  it("generar otro código: desconecta la vinculación en curso y vuelve a conectar (medido con uazapi)", async () => {
    const api = server({ "POST /instance/disconnect": () => json(200, { response: "Disconnected" }), "POST /instance/connect": () => connecting("data:image/png;base64,NUEVO") });
    expect(await new UazapiLinker(api.client, null).restart({ ref: "r", secret: "inst-token" })).toEqual({ kind: "qr", qrImage: "data:image/png;base64,NUEVO" });
    expect(api.calls.map((c) => `${c.method} ${new URL(c.url).pathname}`)).toEqual(["POST /instance/disconnect", "POST /instance/connect"]);
  });
});
