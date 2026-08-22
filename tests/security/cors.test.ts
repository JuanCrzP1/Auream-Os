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
});
