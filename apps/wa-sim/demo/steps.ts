// ---------------------------------------------------------------------------
// Pasos del negocio con el WhatsApp simulado, como los haría una persona:
// conectar un número por QR, armar un flujo con su disparador, escribir como
// cliente, responder como asesor. Hablan con la API de Auream (como la web)
// y con el teléfono de prueba (`/_sim/*`).
//
// Los usan los recorridos automáticos (`tests/e2e`) y los datos de
// demostración (`npm run sim:demo`): la misma historia, un solo código.
// Este archivo sabe de los dos lados a propósito; el simulador no lo importa.
// ---------------------------------------------------------------------------

export type Json = Record<string, unknown>;

export interface Clients {
  /** La API de Auream, con una clave de la cuenta. */
  api<T = Json>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }>;
  /** El teléfono de prueba: lo que hace el cliente. */
  phone<T = Json>(method: string, path: string, body?: unknown): Promise<T>;
}

export interface SimClient {
  readonly phone: string;
  readonly name: string;
  /** Llega desde un anuncio de Meta (clic a WhatsApp) con ese id de anuncio. */
  readonly adId?: string;
}

/** La respuesta, o un error en español con lo que dijo la API. */
export function ok<T>(response: { status: number; body: T }, what: string): T {
  if (response.status >= 400) throw new Error(`${what}: ${response.status} ${JSON.stringify(response.body)}`);
  return response.body;
}

/** Espera hasta que `check` devuelva algo (o falla con `what`). */
export async function eventually<T>(what: string, check: () => Promise<T | null | undefined | false>, timeoutMs = 10_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > until) throw new Error(`No pasó a tiempo: ${what}.`);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

/** El número del simulador que corresponde a una conexión de Auream (`auream-<id>`). */
export async function instanceOf(c: Clients, connectionId: string): Promise<{ id: string; status: string } | null> {
  const state = await c.phone<{ instances: Array<{ id: string; name: string; status: string }> }>("GET", "/_sim/state");
  return state.instances.find((instance) => instance.name === `auream-${connectionId}`) ?? null;
}

/** Crea la conexión, pide el QR, lo «escanea» el teléfono y espera a que Auream la vea conectada. */
export async function connectByQr(c: Clients, name: string, businessPhone: string, profileName: string) {
  const created = ok(await c.api<Json>("POST", "/connections", { name, method: "qr" }), "crear la conexión");
  const connectionId = String(created["id"]);
  const link = ok(await c.api<Json>("POST", `/connections/${connectionId}/link`, {}), "pedir el QR");
  const instance = await eventually("el simulador recibe la conexión", () => instanceOf(c, connectionId));
  await c.phone("POST", `/_sim/instances/${instance.id}/scan`, { phone: businessPhone, profileName });
  const status = await eventually("el número queda conectado", async () => {
    const current = ok(await c.api<Json>("GET", `/connections/${connectionId}/status`), "estado de la conexión");
    return current["state"] === "connected" ? current : null;
  });
  return { connectionId, instanceId: instance.id, link, status };
}

/** Un flujo que saluda con `text`, disparado cuando el cliente escribe `keyword`. */
export async function addGreetingFlow(c: Clients, connectionId: string, name: string, keyword: string, text: string) {
  const flow = ok(await c.api<Json>("POST", "/automations", { name }), "crear el flujo");
  const key = String(flow["key"] ?? flow["id"]);
  const workspace = ok(await c.api<{ draft: Json; autosaveRevision: number }>("GET", `/api/builder/flows/${key}/workspace`), "abrir el flujo");
  const draft = workspace.draft as { version: { entryNodeId: string }; nodes: Record<string, Json>; edgesBySource: Record<string, Json[]> };
  const entry = draft.version.entryNodeId;
  const message = { id: "saludo", type: "message", name: "Saludo", content: { text }, config: {}, metadata: {} };
  const edge = { id: "e-saludo", fromNodeId: entry, toNodeId: "saludo", priority: 0, isFallback: false, condition: { operator: "always" } };
  const edges = { ...draft.edgesBySource, [entry]: [...(draft.edgesBySource[entry] ?? []), edge] };
  ok(await c.api("PUT", `/api/builder/flows/${key}/draft`, { draft: { ...draft, nodes: { ...draft.nodes, saludo: message }, edgesBySource: edges }, baseRevision: workspace.autosaveRevision }), "guardar el flujo");
  ok(await c.api("POST", `/connections/${connectionId}/triggers`, { type: "keyword", keywords: [keyword], match: "contains", automationId: String(flow["id"]) }), "crear el disparador");
  return { flowId: String(flow["id"]), key };
}

/** El cliente aparece en el teléfono de prueba y escribe. */
export async function clientWrites(c: Clients, instanceId: string, client: SimClient, text: string): Promise<void> {
  await c.phone("POST", "/_sim/contacts", { phone: client.phone, name: client.name, ...(client.adId ? { fromAd: true, adId: client.adId } : {}) });
  await c.phone("POST", `/_sim/chats/${instanceId}/${client.phone}/send`, { text });
}

/** Lo que ve el cliente en su chat con el negocio. */
export async function chatOf(c: Clients, instanceId: string, phone: string): Promise<Json[]> {
  return (await c.phone<{ messages?: Json[] }>("GET", `/_sim/chats/${instanceId}/${phone}`)).messages ?? [];
}

/** El chat de ese número en la bandeja de Auream (o null si aún no llega). */
export async function conversationOf(c: Clients, phone: string): Promise<Json | null> {
  const list = ok(await c.api<{ conversations: Json[] }>("GET", "/conversations?filter=all"), "abrir la bandeja");
  return list.conversations.find((conversation) => conversation["phone"] === phone) ?? null;
}

/** Espera el chat en la bandeja y devuelve su id. */
export async function conversationIdOf(c: Clients, phone: string): Promise<string> {
  return String((await eventually(`el chat de ${phone} llega a la bandeja`, () => conversationOf(c, phone)))["id"]);
}

/** El cliente escribe y espera a que su mensaje llegue a la bandeja (devuelve el id del chat). */
export async function clientWritesAndArrives(c: Clients, instanceId: string, client: SimClient, text: string): Promise<string> {
  const before = (await conversationOf(c, client.phone))?.["lastMessageAt"] ?? null;
  await clientWrites(c, instanceId, client, text);
  const arrived = await eventually(`el mensaje de ${client.name} llega a la bandeja`, async () => {
    const conversation = await conversationOf(c, client.phone);
    return conversation && conversation["lastMessageAt"] !== before ? conversation : null;
  });
  return String(arrived["id"]);
}

/** El asesor responde desde la bandeja. */
export async function advisorReplies(c: Clients, conversationId: string, text: string): Promise<void> {
  ok(await c.api("POST", `/conversations/${conversationId}/messages`, { text }), "responder como asesor");
}
