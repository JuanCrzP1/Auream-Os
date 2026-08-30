import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ForgotPasswordPage } from "../../src/features/auth/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../../src/features/auth/pages/ResetPasswordPage";
import { ThemeProvider } from "../../src/shared/theme/context/ThemeContext";

// ---------------------------------------------------------------------------
// Pantallas de recuperación. Lo que se comprueba aquí es el contrato con el
// usuario: no revelar si un correo existe, y no aceptar un enlace sin token.
// ---------------------------------------------------------------------------

function mockAuth(status: number, body: unknown) {
  const spy = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

// `AuthLayout` incluye el conmutador de tema, que exige su provider.
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ForgotPasswordPage", () => {
  it("muestra una confirmación genérica que no revela si la cuenta existe", async () => {
    mockAuth(200, { status: true });
    renderAt("/forgot-password");

    await userEvent.type(screen.getByLabelText(/correo/i), "quien-sea@example.com");
    await userEvent.click(screen.getByRole("button", { name: /enviar enlace/i }));

    await waitFor(() => expect(screen.getByText(/revisa tu correo/i)).toBeInTheDocument());
    expect(screen.getByRole("status").textContent).not.toMatch(/no existe|no encontrad|no registrad/i);
  });

  it("pide la recuperación al endpoint del proveedor, no a uno propio", async () => {
    const spy = mockAuth(200, { status: true });
    renderAt("/forgot-password");

    await userEvent.type(screen.getByLabelText(/correo/i), "ana@example.com");
    await userEvent.click(screen.getByRole("button", { name: /enviar enlace/i }));

    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(String(spy.mock.calls[0]![0])).toContain("/request-password-reset");
  });
});

describe("ResetPasswordPage", () => {
  it("rechaza el enlace cuando no trae token", () => {
    renderAt("/reset-password");

    expect(screen.getByText(/enlace no válido/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^nueva contraseña$/i)).not.toBeInTheDocument();
  });

  it("rechaza el enlace cuando el proveedor ya marcó el token como inválido", () => {
    renderAt("/reset-password?error=INVALID_TOKEN");

    expect(screen.getByText(/enlace no válido/i)).toBeInTheDocument();
  });

  it("con token válido cambia la contraseña y confirma el éxito", async () => {
    mockAuth(200, { status: true });
    renderAt("/reset-password?token=un-token");

    await userEvent.type(screen.getByLabelText(/^nueva contraseña$/i), "contrasena-nueva");
    await userEvent.type(screen.getByLabelText(/confirmar nueva contraseña/i), "contrasena-nueva");
    await userEvent.click(screen.getByRole("button", { name: /cambiar contraseña/i }));

    await waitFor(() => expect(screen.getByText(/contraseña actualizada/i)).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent(/anterior ha dejado de funcionar/i);
  });

  it("muestra el mensaje correcto si el token resulta inválido al enviarlo", async () => {
    mockAuth(400, { message: "Invalid token", code: "INVALID_TOKEN" });
    renderAt("/reset-password?token=caducado");

    await userEvent.type(screen.getByLabelText(/^nueva contraseña$/i), "contrasena-nueva");
    await userEvent.type(screen.getByLabelText(/confirmar nueva contraseña/i), "contrasena-nueva");
    await userEvent.click(screen.getByRole("button", { name: /cambiar contraseña/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/no es válido o ha caducado/i)
    );
  });
});
