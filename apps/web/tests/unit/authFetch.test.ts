import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthRequestError, authFetch } from "../../src/shared/auth/client/authFetch";

// ---------------------------------------------------------------------------
// authFetch debe conservar el código del proveedor: sin él, el traductor de
// mensajes no puede distinguir dos fallos que comparten status HTTP.
// ---------------------------------------------------------------------------

function respondWith(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authFetch", () => {
  it("conserva status, code y mensaje del proveedor", async () => {
    respondWith(401, { message: "Invalid email or password", code: "INVALID_EMAIL_OR_PASSWORD" });

    const error = await authFetch("/sign-in/email").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AuthRequestError);
    expect((error as AuthRequestError).status).toBe(401);
    expect((error as AuthRequestError).code).toBe("INVALID_EMAIL_OR_PASSWORD");
  });

  it("deja code en null si el proveedor no lo envía", async () => {
    respondWith(500, { message: "boom" });

    const error = (await authFetch("/token").catch((e: unknown) => e)) as AuthRequestError;

    expect(error.code).toBeNull();
    expect(error.status).toBe(500);
  });

  it("no rompe si el cuerpo del error no es JSON legible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error("not json");
        }
      })
    );

    const error = (await authFetch("/token").catch((e: unknown) => e)) as AuthRequestError;

    expect(error).toBeInstanceOf(AuthRequestError);
    expect(error.status).toBe(502);
    expect(error.code).toBeNull();
  });

  it("envía la cookie de sesión del proveedor", async () => {
    respondWith(200, { ok: true });

    await authFetch("/get-session");

    const [, init] = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    expect((init as RequestInit).credentials).toBe("include");
  });
});
