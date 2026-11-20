import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useSignOut } from "../../src/shared/auth/hooks/useSignOut";

// ---------------------------------------------------------------------------
// Cerrar sesión quita los avisos de este dispositivo ANTES de salir (con la
// sesión todavía abierta), para que quien entre después no reciba los tuyos.
// Si eso falla, igual se cierra sesión.
// ---------------------------------------------------------------------------

const order: string[] = [];
const signOut = vi.fn(async () => void order.push("signOut"));
const disable = vi.fn(async () => void order.push("disable"));
vi.mock("../../src/shared/auth/context/AuthContext", () => ({ useAuth: () => ({ signOut }) }));
vi.mock("@shared/notifications/devicePush", () => ({ disableOnThisDevice: () => disable() }));

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

describe("cerrar sesión", () => {
  it("primero quita los avisos de este dispositivo; si eso falla, igual sale", async () => {
    const { result } = renderHook(() => useSignOut(), { wrapper });
    await result.current();
    expect(order).toEqual(["disable", "signOut"]);

    disable.mockRejectedValueOnce(new Error("sin red"));
    await result.current();
    expect(signOut).toHaveBeenCalledTimes(2);
  });
});
