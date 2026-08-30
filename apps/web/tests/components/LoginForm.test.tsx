import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LoginForm } from "../../src/features/auth/components/LoginForm";

// El formulario enlaza a `/forgot-password`, así que necesita un router.
function renderForm(props: Parameters<typeof LoginForm>[0]) {
  return render(
    <MemoryRouter>
      <LoginForm {...props} />
    </MemoryRouter>
  );
}

describe("LoginForm", () => {
  it("envía las credenciales introducidas", async () => {
    const onSubmit = vi.fn();
    renderForm({ pending: false, error: null, onSubmit });

    await userEvent.type(screen.getByLabelText(/correo/i), "ana@example.com");
    await userEvent.type(screen.getByLabelText(/^contraseña$/i), "secreto-largo");
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(onSubmit).toHaveBeenCalledWith("ana@example.com", "secreto-largo");
  });

  it("muestra el error recibido", () => {
    renderForm({ pending: false, error: "Email o contraseña incorrectos.", onSubmit: vi.fn() });

    expect(screen.getByRole("alert")).toHaveTextContent("Email o contraseña incorrectos.");
  });

  it("no muestra alerta cuando no hay error", () => {
    renderForm({ pending: false, error: null, onSubmit: vi.fn() });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("deshabilita el envío mientras está en curso", () => {
    renderForm({ pending: true, error: null, onSubmit: vi.fn() });

    expect(screen.getByRole("button", { name: /entrando/i })).toBeDisabled();
  });

  it("ofrece la recuperación de contraseña", () => {
    renderForm({ pending: false, error: null, onSubmit: vi.fn() });

    expect(screen.getByRole("link", { name: /olvidaste tu contraseña/i })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
  });

  it("permite revelar y volver a ocultar la contraseña", async () => {
    renderForm({ pending: false, error: null, onSubmit: vi.fn() });

    const field = screen.getByLabelText(/^contraseña$/i);
    expect(field).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: /mostrar contraseña/i }));
    expect(field).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: /ocultar contraseña/i }));
    expect(field).toHaveAttribute("type", "password");
  });
});
