import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "../../src/features/auth/components/LoginForm";

describe("LoginForm", () => {
  it("envía las credenciales introducidas", async () => {
    const onSubmit = vi.fn();
    render(<LoginForm pending={false} error={null} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/correo/i), "ana@example.com");
    await userEvent.type(screen.getByLabelText(/contraseña/i), "secreto-largo");
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(onSubmit).toHaveBeenCalledWith("ana@example.com", "secreto-largo");
  });

  it("muestra el error recibido", () => {
    render(<LoginForm pending={false} error="Credenciales incorrectas." onSubmit={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Credenciales incorrectas.");
  });

  it("no muestra alerta cuando no hay error", () => {
    render(<LoginForm pending={false} error={null} onSubmit={vi.fn()} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("deshabilita el envío mientras está en curso", () => {
    render(<LoginForm pending error={null} onSubmit={vi.fn()} />);

    expect(screen.getByRole("button", { name: /entrando/i })).toBeDisabled();
  });
});
