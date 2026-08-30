import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "../../src/shared/auth/context/AuthContext";
import { tokenStore } from "../../src/shared/auth/client/tokenStore";

// ---------------------------------------------------------------------------
// Ciclo de sesión visto desde el frontend. La cookie la gestiona el proveedor;
// aquí se comprueba que la aplicación la interpreta bien: restaurar al cargar,
// quedar anónimo si no hay, y no conservar nada tras cerrar sesión.
// ---------------------------------------------------------------------------

const USER = { id: "u-1", email: "ana@example.com", name: "Ana" };

function mockAuthEndpoints(handler: (path: string) => { status: number; body: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const { status, body } = handler(new URL(url).pathname);
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body
      });
    })
  );
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  tokenStore.clear();
});

describe("sesión", () => {
  it("restaura la sesión al montar cuando la cookie sigue vigente", async () => {
    mockAuthEndpoints(() => ({ status: 200, body: { user: USER } }));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.state.status).toBe("authenticated"));
    expect(result.current.state).toMatchObject({ session: { email: "ana@example.com" } });
  });

  it("queda anónimo cuando el proveedor no devuelve sesión", async () => {
    mockAuthEndpoints(() => ({ status: 200, body: null }));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.state.status).toBe("anonymous"));
  });

  it("queda anónimo si el proveedor falla, nunca dentro de la aplicación sin sesión", async () => {
    mockAuthEndpoints(() => ({ status: 500, body: { message: "boom" } }));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.state.status).toBe("anonymous"));
  });

  it("tras cerrar sesión el estado es anónimo y no queda token en memoria", async () => {
    mockAuthEndpoints((path) =>
      path.endsWith("/get-session")
        ? { status: 200, body: { user: USER } }
        : { status: 200, body: { success: true } }
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe("authenticated"));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.state.status).toBe("anonymous");
    expect(await tokenStore.get()).toBeNull();
  });

  it("el estado queda anónimo aunque la llamada de cierre falle", async () => {
    mockAuthEndpoints((path) =>
      path.endsWith("/get-session")
        ? { status: 200, body: { user: USER } }
        : { status: 500, body: { message: "boom" } }
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe("authenticated"));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.state.status).toBe("anonymous");
  });
});

describe("sesión revocada mientras la pestaña sigue abierta", () => {
  it("pasa a anónimo cuando el proveedor deja de renovar el token", async () => {
    // Sesión válida al cargar, pero /token empieza a fallar: es lo que ocurre
    // cuando cambiar la contraseña revoca el resto de sesiones.
    mockAuthEndpoints((path) =>
      path.endsWith("/get-session")
        ? { status: 200, body: { user: USER } }
        : { status: 401, body: { message: "Session expired" } }
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe("authenticated"));

    await act(async () => {
      await tokenStore.get();
    });

    expect(result.current.state.status).toBe("anonymous");
  });

  it("no deja token utilizable tras perder la sesión", async () => {
    mockAuthEndpoints((path) =>
      path.endsWith("/get-session")
        ? { status: 200, body: { user: USER } }
        : { status: 401, body: { message: "Session expired" } }
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe("authenticated"));

    await act(async () => {
      await tokenStore.get();
    });

    expect(await tokenStore.get()).toBeNull();
  });
});

describe("tokenStore", () => {
  it("no pide token si no hay sesión confirmada", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(await tokenStore.get()).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("no guarda nada en localStorage", async () => {
    mockAuthEndpoints(() => ({ status: 200, body: { user: USER } }));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe("authenticated"));

    expect(Object.keys(localStorage)).not.toContain("token");
    expect(JSON.stringify(localStorage)).not.toContain("ana@example.com");
  });
});
