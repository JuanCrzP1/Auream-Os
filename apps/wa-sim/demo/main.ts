import { addGreetingFlow, advisorReplies, clientWritesAndArrives, connectByQr, instanceOf, ok, type Clients, type Json, type SimClient } from "./steps.js";

// ---------------------------------------------------------------------------
// Datos de demostración en segundos (`npm run sim:demo`): con la API local y
// el simulador corriendo, arma un día de negocio de ejemplo en la cuenta de la
// clave de desarrollo: un número conectado, un flujo que saluda, un producto y
// cuatro clientes (dos llegan por anuncio, una compra, uno tiene un mensaje
// programado). Se puede correr varias veces: reutiliza el número, el flujo y
// el producto; cada corrida suma mensajes nuevos y otra venta de Marta.
//
// Solo en tu máquina: la API y el simulador deben estar en localhost, y la
// clave de desarrollo no existe en producción.
// ---------------------------------------------------------------------------

const CONNECTION = "Demo";
const FLOW = "Bienvenida (demo)";
const PRODUCT = "Plan demo";
const AD = "demo-anuncio-1";
const CLIENTS: Record<string, SimClient> = {
  laura: { phone: "573001110001", name: "Laura Gómez" },
  carlos: { phone: "573001110002", name: "Carlos Ruiz", adId: AD },
  marta: { phone: "573001110003", name: "Marta Díaz", adId: AD },
  pedro: { phone: "573001110004", name: "Pedro Silva" }
};

function localUrl(name: string, value: string): string {
  const url = new URL(value);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error(`${name} debe ser local (localhost); es ${url.host}.`);
  return url.origin;
}

function clientsOf(apiBase: string, simBase: string, apiKey: string): Clients {
  const call = async (base: string, method: string, path: string, body: unknown, headers: Record<string, string>) => {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : {} };
  };
  return {
    api: (method, path, body) => call(apiBase, method, path, body, { "x-api-key": apiKey }),
    phone: async (method, path, body) => (await call(simBase, method, path, body, {})).body
  };
}

/** El número «Demo» conectado: el de una corrida anterior si sigue vivo en el simulador, o uno nuevo. */
async function demoNumber(c: Clients): Promise<{ connectionId: string; instanceId: string }> {
  const { connections } = ok(await c.api<{ connections: Json[] }>("GET", "/connections"), "leer las conexiones");
  const previous = connections.find((connection) => connection["name"] === CONNECTION);
  if (previous) {
    const instance = await instanceOf(c, String(previous["id"]));
    if (instance?.status === "connected" && previous["status"] === "connected") return { connectionId: String(previous["id"]), instanceId: instance.id };
    throw new Error(`La conexión «${CONNECTION}» de una corrida anterior ya no está en el simulador (¿lo empezaste de cero?). Bórrala en Auream → Conexiones y vuelve a correr.`);
  }
  const created = await connectByQr(c, CONNECTION, "573110000099", "Tienda Demo");
  const flow = await addGreetingFlow(c, created.connectionId, FLOW, "hola", "¡Hola! 👋 Bienvenido a Tienda Demo. ¿En qué te ayudo?");
  console.log(`  ✓ flujo «${FLOW}» con el disparador «hola» (${flow.flowId})`);
  return created;
}

async function demoProduct(c: Clients): Promise<string> {
  const { products } = ok(await c.api<{ products: Json[] }>("GET", "/products"), "leer los productos");
  const found = products.find((product) => product["name"] === PRODUCT);
  if (found) return String(found["id"]);
  const created = ok(await c.api<Json>("POST", "/products", { name: PRODUCT, kind: "main", prices: [{ country: "CO", currency: "COP", amount: 49900 }] }), "crear el producto");
  return String(created["id"]);
}

async function main(): Promise<void> {
  if (process.env["NODE_ENV"] === "production") throw new Error("Los datos de demostración no se crean en producción.");
  const apiKey = process.env["DEV_API_KEY"]?.trim();
  if (!apiKey) throw new Error("Falta DEV_API_KEY en el .env: es la clave con la que el guion entra a tu cuenta local.");
  const apiBase = localUrl("La API", process.env["AUREAM_API_URL"] ?? `http://localhost:${process.env["PORT"] ?? 3100}`);
  const simBase = localUrl("El simulador", process.env["WHATSAPP_SIMULATOR_URL"] ?? "http://localhost:3200");
  const c = clientsOf(apiBase, simBase, apiKey);

  console.log(`Datos de demostración · API ${apiBase} · simulador ${simBase}`);
  const { instanceId } = await demoNumber(c);
  console.log(`  ✓ número «${CONNECTION}» conectado`);
  const productId = await demoProduct(c);
  console.log(`  ✓ producto «${PRODUCT}» ($49.900 COP)`);

  const [, carlos, marta, pedro] = [
    await clientWritesAndArrives(c, instanceId, CLIENTS["laura"]!, "Hola, quiero información"),
    await clientWritesAndArrives(c, instanceId, CLIENTS["carlos"]!, "Hola, vi el anuncio, ¿cuánto vale?"),
    await clientWritesAndArrives(c, instanceId, CLIENTS["marta"]!, "Hola, quiero comprar el plan"),
    await clientWritesAndArrives(c, instanceId, CLIENTS["pedro"]!, "Buenas, ¿hacen envíos a Medellín?")
  ];
  console.log("  ✓ 4 clientes escribieron (Carlos y Marta llegan por anuncio)");

  await advisorReplies(c, carlos!, "Hola Carlos, el plan cuesta $49.900. ¿Te lo separo?");
  ok(await c.api("POST", "/sales", { conversationId: marta, productId, country: "CO", currency: "COP", amount: 49900 }), "registrar la venta de Marta");
  await advisorReplies(c, pedro!, "Hola Pedro, sí: envíos a todo el país en 2 a 3 días.");
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  ok(await c.api("POST", `/conversations/${pedro}/scheduled`, { parts: [{ kind: "text", text: "Hola Pedro, ¿pudiste revisar lo del envío?" }], date: tomorrow, time: "09:00" }), "programar el mensaje de Pedro");
  console.log("  ✓ el asesor respondió, Marta compró y Pedro tiene un mensaje programado para mañana 9:00 a. m.");

  console.log("\nListo. Abre Auream → Conversaciones (filtro «por anuncio» y «con programados») y Ventas.");
  console.log(`El teléfono de prueba está en ${simBase}.`);
}

main().catch((error: unknown) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
