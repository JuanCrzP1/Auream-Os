import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateFolderModal } from "../../src/features/automations/list/components/CreateFolderModal";

function renderModal(overrides: Partial<Parameters<typeof CreateFolderModal>[0]> = {}) {
  const onConfirm = overrides.onConfirm ?? vi.fn();
  const onCancel = overrides.onCancel ?? vi.fn();
  render(<CreateFolderModal {...overrides} onConfirm={onConfirm} onCancel={onCancel} />);
  return { onConfirm, onCancel, input: screen.getByLabelText("Nombre de la carpeta") };
}

describe("CreateFolderModal", () => {
  it("pide únicamente el nombre de la carpeta", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("da el foco al campo al abrirse", () => {
    const { input } = renderModal();
    expect(input).toHaveFocus();
  });

  it("no permite crear con el nombre vacío", () => {
    renderModal();
    expect(screen.getByRole("button", { name: /crear carpeta/i })).toBeDisabled();
  });

  it("no permite crear con un nombre de sólo espacios", async () => {
    const { onConfirm, input } = renderModal();
    await userEvent.type(input, "   ");
    expect(screen.getByRole("button", { name: /crear carpeta/i })).toBeDisabled();
    await userEvent.type(input, "{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirma con Enter y entrega el nombre sin espacios sobrantes", async () => {
    const { onConfirm, input } = renderModal();
    await userEvent.type(input, "  Ventas  {Enter}");
    expect(onConfirm).toHaveBeenCalledWith("Ventas");
  });

  it("confirma al pulsar el botón", async () => {
    const { onConfirm, input } = renderModal();
    await userEvent.type(input, "Soporte");
    await userEvent.click(screen.getByRole("button", { name: /crear carpeta/i }));
    expect(onConfirm).toHaveBeenCalledWith("Soporte");
  });

  it("cancela con Escape", async () => {
    const { onCancel } = renderModal();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("cancela con el botón Cancelar", async () => {
    const { onCancel } = renderModal();
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("bloquea el formulario mientras la creación está en curso", () => {
    renderModal({ busy: true, onConfirm: vi.fn(), onCancel: vi.fn() });
    expect(screen.getByLabelText("Nombre de la carpeta")).toBeDisabled();
    expect(screen.getByRole("button", { name: /creando/i })).toBeDisabled();
  });

  it("muestra el error cuando la creación falla", () => {
    renderModal({ error: "No se pudo crear la carpeta.", onConfirm: vi.fn(), onCancel: vi.fn() });
    expect(screen.getByRole("alert")).toHaveTextContent(/no se pudo crear/i);
  });
});
