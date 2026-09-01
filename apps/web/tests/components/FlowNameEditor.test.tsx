import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlowNameEditor } from "../../src/features/automations/builder/components/builder-shell/FlowNameEditor";

// ---------------------------------------------------------------------------
// Edición en línea del nombre en la topbar del builder.
//
// Se valida comportamiento —qué ve y qué puede hacer el usuario— y no markup ni
// clases: cambiar el estilo del lápiz no debe romper estos tests, pero perder
// la confirmación con Enter o aceptar un nombre vacío sí.
// ---------------------------------------------------------------------------

const NAME = "Nueva automatización";

function renderEditor(onRename = vi.fn()) {
  render(<FlowNameEditor name={NAME} onRename={onRename} />);
  return onRename;
}

function editor() {
  return screen.getByRole("textbox", { name: /nombre de la automatización/i });
}

describe("FlowNameEditor — vista", () => {
  it("muestra el nombre actual", () => {
    renderEditor();
    expect(screen.getByText(NAME)).toBeInTheDocument();
  });

  it("ofrece un control para editar el nombre", () => {
    renderEditor();
    expect(screen.getByRole("button", { name: /editar nombre/i })).toBeInTheDocument();
  });

  it("deja el nombre completo consultable cuando se recorta", () => {
    renderEditor();
    expect(screen.getByText(NAME)).toHaveAttribute("title", NAME);
  });

  it("no muestra el campo de edición hasta que se pide", () => {
    renderEditor();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("FlowNameEditor — edición", () => {
  it("al pulsar el lápiz entra en edición con el nombre cargado", async () => {
    renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /editar nombre/i }));

    expect(editor()).toHaveValue(NAME);
  });

  it("enfoca el campo automáticamente", async () => {
    renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /editar nombre/i }));

    expect(editor()).toHaveFocus();
  });

  it("Enter confirma el nombre nuevo", async () => {
    const onRename = renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /editar nombre/i }));
    await userEvent.clear(editor());
    await userEvent.type(editor(), "Campaña de bienvenida{Enter}");

    expect(onRename).toHaveBeenCalledWith("Campaña de bienvenida");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("el botón de guardar confirma igual que Enter", async () => {
    const onRename = renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /editar nombre/i }));
    await userEvent.clear(editor());
    await userEvent.type(editor(), "Recuperación de carrito");
    await userEvent.click(screen.getByRole("button", { name: /guardar nombre/i }));

    expect(onRename).toHaveBeenCalledWith("Recuperación de carrito");
  });

  it("Escape cancela y conserva el nombre anterior", async () => {
    const onRename = renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /editar nombre/i }));
    await userEvent.clear(editor());
    await userEvent.type(editor(), "Otro nombre{Escape}");

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText(NAME)).toBeInTheDocument();
  });

  it("el botón de cancelar descarta los cambios", async () => {
    const onRename = renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /editar nombre/i }));
    await userEvent.clear(editor());
    await userEvent.type(editor(), "Descartable");
    await userEvent.click(screen.getByRole("button", { name: /cancelar edición/i }));

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText(NAME)).toBeInTheDocument();
  });

  it("no acepta un nombre vacío ni compuesto sólo por espacios", async () => {
    const onRename = renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /editar nombre/i }));
    await userEvent.clear(editor());
    await userEvent.type(editor(), "   {Enter}");

    expect(onRename).not.toHaveBeenCalled();
    // El campo sigue abierto para que el usuario corrija.
    expect(editor()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar nombre/i })).toBeDisabled();
  });

  it("recorta los espacios sobrantes al confirmar", async () => {
    const onRename = renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /editar nombre/i }));
    await userEvent.clear(editor());
    await userEvent.type(editor(), "   Con espacios   {Enter}");

    expect(onRename).toHaveBeenCalledWith("Con espacios");
  });

  it("no avisa de renombrado si el nombre no cambió", async () => {
    const onRename = renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /editar nombre/i }));
    await userEvent.type(editor(), "{Enter}");

    expect(onRename).not.toHaveBeenCalled();
  });

  it("salir del campo no guarda en silencio", async () => {
    const onRename = renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /editar nombre/i }));
    await userEvent.clear(editor());
    await userEvent.type(editor(), "Sin confirmar");
    await userEvent.tab();

    expect(onRename).not.toHaveBeenCalled();
  });

  it("admite un nombre largo sin perderlo", async () => {
    const largo = "Campaña de recuperación de carritos abandonados para clientes recurrentes";
    const onRename = renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /editar nombre/i }));
    await userEvent.clear(editor());
    await userEvent.type(editor(), `${largo}{Enter}`);

    expect(onRename).toHaveBeenCalledWith(largo);
  });
});
