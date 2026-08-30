import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "../../src/features/auth/components/RegisterForm";

// ---------------------------------------------------------------------------
// La confirmación de contraseña impide el fallo que originó esta fase: crear
// la cuenta con una contraseña mal tecleada y descubrirlo al intentar entrar.
// ---------------------------------------------------------------------------

async function fill(name: string, email: string, password: string, confirmation: string) {
  await userEvent.type(screen.getByLabelText(/nombre/i), name);
  await userEvent.type(screen.getByLabelText(/correo/i), email);
  await userEvent.type(screen.getByLabelText(/^contraseña$/i), password);
  await userEvent.type(screen.getByLabelText(/confirmar contraseña/i), confirmation);
}

describe("RegisterForm", () => {
  it("envía los datos cuando la contraseña es válida y coincide", async () => {
    const onSubmit = vi.fn();
    render(<RegisterForm pending={false} error={null} onSubmit={onSubmit} />);

    await fill("Ana", "ana@example.com", "contrasena-larga", "contrasena-larga");
    await userEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(onSubmit).toHaveBeenCalledWith("ana@example.com", "contrasena-larga", "Ana");
  });

  it("no envía nada si las contraseñas no coinciden", async () => {
    const onSubmit = vi.fn();
    render(<RegisterForm pending={false} error={null} onSubmit={onSubmit} />);

    await fill("Ana", "ana@example.com", "contrasena-larga", "contrasena-corta");
    await userEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("no envía una contraseña por debajo del mínimo del proveedor", async () => {
    const onSubmit = vi.fn();
    render(<RegisterForm pending={false} error={null} onSubmit={onSubmit} />);

    await fill("Ana", "ana@example.com", "corta12", "corta12");
    await userEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("acepta exactamente el mínimo de 8 caracteres", async () => {
    const onSubmit = vi.fn();
    render(<RegisterForm pending={false} error={null} onSubmit={onSubmit} />);

    await fill("Ana", "ana@example.com", "12345678", "12345678");
    await userEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(onSubmit).toHaveBeenCalled();
  });

  it("muestra el error recibido", () => {
    render(
      <RegisterForm
        pending={false}
        error="Ya existe una cuenta con este correo. Inicia sesión."
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Ya existe una cuenta");
  });

  it("deshabilita el envío mientras está en curso", () => {
    render(<RegisterForm pending error={null} onSubmit={vi.fn()} />);

    expect(screen.getByRole("button", { name: /creando/i })).toBeDisabled();
  });

  it("permite revelar la contraseña escrita", async () => {
    render(<RegisterForm pending={false} error={null} onSubmit={vi.fn()} />);

    const field = screen.getByLabelText(/^contraseña$/i);
    expect(field).toHaveAttribute("type", "password");

    await userEvent.click(screen.getAllByRole("button", { name: /mostrar contraseña/i })[0]!);

    expect(field).toHaveAttribute("type", "text");
  });
});
