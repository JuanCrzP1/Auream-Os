import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetPasswordForm } from "../../src/features/auth/components/ResetPasswordForm";
import { ForgotPasswordForm } from "../../src/features/auth/components/ForgotPasswordForm";

describe("ResetPasswordForm", () => {
  async function fill(password: string, confirmation: string) {
    await userEvent.type(screen.getByLabelText(/^nueva contraseña$/i), password);
    await userEvent.type(screen.getByLabelText(/confirmar nueva contraseña/i), confirmation);
  }

  it("envía la nueva contraseña cuando es válida y coincide", async () => {
    const onSubmit = vi.fn();
    render(<ResetPasswordForm pending={false} error={null} onSubmit={onSubmit} />);

    await fill("contrasena-nueva", "contrasena-nueva");
    await userEvent.click(screen.getByRole("button", { name: /cambiar contraseña/i }));

    expect(onSubmit).toHaveBeenCalledWith("contrasena-nueva");
  });

  it("no envía si la confirmación no coincide", async () => {
    const onSubmit = vi.fn();
    render(<ResetPasswordForm pending={false} error={null} onSubmit={onSubmit} />);

    await fill("contrasena-nueva", "otra-distinta");
    await userEvent.click(screen.getByRole("button", { name: /cambiar contraseña/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("no envía una contraseña por debajo del mínimo", async () => {
    const onSubmit = vi.fn();
    render(<ResetPasswordForm pending={false} error={null} onSubmit={onSubmit} />);

    await fill("corta12", "corta12");
    await userEvent.click(screen.getByRole("button", { name: /cambiar contraseña/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("muestra el error de token inválido", () => {
    render(
      <ResetPasswordForm
        pending={false}
        error="Este enlace de recuperación no es válido o ha caducado. Solicita uno nuevo."
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("no es válido o ha caducado");
  });

  it("deshabilita el envío mientras está en curso", () => {
    render(<ResetPasswordForm pending error={null} onSubmit={vi.fn()} />);

    expect(screen.getByRole("button", { name: /cambiando/i })).toBeDisabled();
  });
});

describe("ForgotPasswordForm", () => {
  it("envía el correo introducido", async () => {
    const onSubmit = vi.fn();
    render(<ForgotPasswordForm pending={false} error={null} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/correo/i), "ana@example.com");
    await userEvent.click(screen.getByRole("button", { name: /enviar enlace/i }));

    expect(onSubmit).toHaveBeenCalledWith("ana@example.com");
  });

  it("deshabilita el envío mientras está en curso", () => {
    render(<ForgotPasswordForm pending error={null} onSubmit={vi.fn()} />);

    expect(screen.getByRole("button", { name: /enviando/i })).toBeDisabled();
  });
});
