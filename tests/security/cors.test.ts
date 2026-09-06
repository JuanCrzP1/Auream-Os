import { describe, expect, it } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { applyCorsHeaders } from "../../apps/api/middleware/applyCorsHeaders.js";

const ALLOWED = ["https://app.example.com"];

function fakeExchange(origin?: string) {
  const headers = new Map<string, string>();

  const request = { headers: origin ? { origin } : {} } as unknown as IncomingMessage;
  const response = {
    setHeader: (name: string, value: string) => headers.set(name, value)
  } as unknown as ServerResponse;

  return { request, response, headers };
}

describe("applyCorsHeaders", () => {
  it("refleja unicamente un origen permitido", () => {
    const { request, response, headers } = fakeExchange("https://app.example.com");

    applyCorsHeaders(request, response, ALLOWED);

    expect(headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
  });

  it("no emite cabecera para un origen no permitido", () => {
    const { request, response, headers } = fakeExchange("https://atacante.example.com");

    applyCorsHeaders(request, response, ALLOWED);

    expect(headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("nunca emite el comodin", () => {
    const { request, response, headers } = fakeExchange("https://app.example.com");

    applyCorsHeaders(request, response, ALLOWED);

    expect(headers.get("Access-Control-Allow-Origin")).not.toBe("*");
  });

  it("marca Vary: Origin para no envenenar caches intermedias", () => {
    const { request, response, headers } = fakeExchange("https://app.example.com");

    applyCorsHeaders(request, response, ALLOWED);

    expect(headers.get("Vary")).toBe("Origin");
  });

  // -------------------------------------------------------------------------
  // LAS CABECERAS QUE EL CLIENTE ENVÍA DE VERDAD.
  //
  // Una cabecera que el cliente manda y el servidor no autoriza no produce un
  // error legible: el navegador bloquea la petición ENTERA antes de enviarla y
  // `fetch` rechaza con un `TypeError` idéntico al de estar sin red. Eso dejó
  // al builder sin guardar nada durante semanas, con la interfaz respondiendo
  // como si todo fuera bien.
  //
  // Por eso esto se comprueba contra la lista que usa el cliente y no contra
  // una copia escrita a mano aquí.
  // -------------------------------------------------------------------------

  it("autoriza todas las cabeceras que el cliente del builder envía", () => {
    const { request, response, headers } = fakeExchange("https://app.example.com");

    applyCorsHeaders(request, response, ALLOWED);

    const permitidas = String(headers.get("Access-Control-Allow-Headers"))
      .split(",")
      .map((h) => h.trim().toLowerCase());

    // `X-Tenant-Id` viaja en toda petición del builder desde que existe la
    // tenencia; `Authorization` con sesión y `X-Api-Key` en desarrollo local.
    for (const cabecera of ["content-type", "authorization", "x-api-key", "x-tenant-id"]) {
      expect(permitidas, `falta '${cabecera}' en la lista blanca`).toContain(cabecera);
    }
  });

  it("un origen no permitido no recibe ninguna cabecera autorizada", () => {
    const { request, response, headers } = fakeExchange("https://intruso.example.com");

    applyCorsHeaders(request, response, ALLOWED);

    expect(headers.get("Access-Control-Allow-Headers")).toBeUndefined();
  });
});
