import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startStack, type Stack } from "./harness/stack.js";
import {
  addGreetingFlow,
  advisorReplies,
  chatOf,
  clientWrites,
  connectByQr,
  conversationIdOf,
  conversationOf,
  eventually,
  ok,
  type Json
} from "../../apps/wa-sim/demo/steps.js";

// ---------------------------------------------------------------------------
// Recorrido de punta a punta: un día de un negocio en Auream con el WhatsApp
// simulado. Todo pasa por la API real (como la web) y por el cliente real de
// uazapi; el «cliente» escribe desde el teléfono de prueba. En orden:
//
//   1. conectar un número por QR
//   2. un flujo con el disparador «Hola» le responde al cliente
//   3. el asesor responde desde la bandeja y le llega (✓✓ entregado, leído)
//   4. una clienta llega por un anuncio: la bandeja lo marca y su venta,
//      registrada desde el chat, queda amarrada a ese anuncio
//   5. un mensaje programado: se ve pendiente y «Enviar ahora» lo entrega
// ---------------------------------------------------------------------------

let stack: Stack;
let instanceId = "";
const LAURA = { phone: "573009990001", name: "Laura" };
const MARTA = { phone: "573009990002", name: "Marta", adId: "120244999" };

beforeAll(async () => {
  stack = await startStack("whatsapp");
});
afterAll(async () => {
  await stack?.stop();
});

describe("Un día en Auream con el WhatsApp simulado", () => {
  let connectionId = "";

  it("1. conectar un número por QR", async () => {
    const connected = await connectByQr(stack, "Ventas", "573110000077", "Tienda de prueba");
    connectionId = connected.connectionId;
    instanceId = connected.instanceId;
    expect(JSON.stringify(connected.link)).toContain("data:image/");
    expect(connected.status).toMatchObject({ state: "connected", connection: { status: "connected", phoneNumber: "573110000077" } });
  });

  it("2. el disparador «Hola» corre el flujo y el bot le responde al cliente", async () => {
    await addGreetingFlow(stack, connectionId, "Bienvenida", "hola", "¡Hola! Soy el bot de la tienda 👋");
    await clientWrites(stack, instanceId, LAURA, "Hola, quiero información");
    await eventually("llega la bienvenida del bot", async () => (await chatOf(stack, instanceId, LAURA.phone)).find((m) => m["fromBusiness"] === true && String(m["text"]).includes("Soy el bot")));
    expect(await eventually("el chat aparece en la bandeja", () => conversationOf(stack, LAURA.phone))).toMatchObject({ phone: LAURA.phone, fromAd: false });
  });

  it("3. el asesor responde desde la bandeja: le llega al cliente, entregado y leído", async () => {
    const conversationId = await conversationIdOf(stack, LAURA.phone);
    await advisorReplies(stack, conversationId, "Hola Laura, te atiendo yo");
    await eventually("le llega al cliente con ✓✓", async () => (await chatOf(stack, instanceId, LAURA.phone)).find((m) => m["text"] === "Hola Laura, te atiendo yo" && m["status"] === "delivered"));

    await stack.phone("POST", `/_sim/chats/${instanceId}/${LAURA.phone}/read`, {});
    await eventually("Auream lo ve leído", async () => {
      const thread = ok(await stack.api<{ messages: Json[] }>("GET", `/conversations/${conversationId}/messages`), "hilo");
      return thread.messages.find((m) => m["text"] === "Hola Laura, te atiendo yo" && m["status"] === "read");
    });
  });

  it("4. una clienta llega por un anuncio: la bandeja la marca y su venta queda amarrada a ese anuncio", async () => {
    await clientWrites(stack, instanceId, MARTA, "Vi su anuncio, ¿precio?");
    const conversation = await eventually("llega marcada «por anuncio»", async () => {
      const found = await conversationOf(stack, MARTA.phone);
      return found && found["fromAd"] === true ? found : null;
    });
    const ad = ok(await stack.api<{ ad: Json | null }>("GET", `/conversations/${String(conversation["id"])}/ad`), "anuncio de origen");
    expect(ad.ad).toMatchObject({ sourceId: MARTA.adId, connected: false });

    const product = ok(await stack.api<Json>("POST", "/products", { name: "Video personalizado", kind: "main", prices: [{ country: "CO", currency: "COP", amount: 49900 }] }), "crear producto");
    const sale = ok(await stack.api<Json>("POST", "/sales", { conversationId: conversation["id"], productId: product["id"], country: "CO", currency: "COP", amount: 49900 }), "registrar venta");
    expect(sale).toMatchObject({ status: "approved", adSourceId: MARTA.adId, customerPhone: MARTA.phone });
  });

  it("5. un mensaje programado se ve pendiente y «Enviar ahora» se lo entrega al cliente", async () => {
    const conversationId = await conversationIdOf(stack, LAURA.phone);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const scheduled = ok(await stack.api<{ messages: Json[] }>("POST", `/conversations/${conversationId}/scheduled`, { parts: [{ kind: "text", text: "Recordatorio: ¿pudiste pagar?" }], date: tomorrow, time: "09:00" }), "programar");
    expect(scheduled.messages).toHaveLength(1);
    expect(await conversationOf(stack, LAURA.phone)).toMatchObject({ nextScheduledAt: expect.any(String) });

    ok(await stack.api("POST", `/conversations/${conversationId}/scheduled/${String(scheduled.messages[0]!["id"])}/send`, {}), "enviar ahora");
    await eventually("le llega el recordatorio", async () => (await chatOf(stack, instanceId, LAURA.phone)).find((m) => m["text"] === "Recordatorio: ¿pudiste pagar?"));
    expect(await conversationOf(stack, LAURA.phone)).toMatchObject({ nextScheduledAt: null });
  });
});
