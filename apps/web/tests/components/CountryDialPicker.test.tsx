import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { CountryDialPicker } from "@features/automations/builder/tools/_kit/CountryDialPicker";

// Prefijo con bandera, como en Leona: lista con bandera, país y prefijo, con
// buscador por nombre o número; guarda solo el prefijo.

function setup(value = "57") {
  const onChange = vi.fn();
  render(
    <div className="kit-editor">
      <CountryDialPicker value={value} onChange={onChange} />
    </div>
  );
  return { onChange, trigger: screen.getByRole("button", { name: /Prefijo del país/ }) };
}

describe("CountryDialPicker", () => {
  it("muestra la bandera y el prefijo elegidos, y abre la lista de países con su prefijo", () => {
    const { trigger } = setup("58");
    expect(trigger).toHaveTextContent("🇻🇪+58");
    expect(trigger).toHaveAccessibleName("Prefijo del país: Venezuela +58");

    fireEvent.click(trigger);
    const list = screen.getByRole("listbox");
    expect(within(list).getByRole("option", { name: /Colombia\s*\+57/ })).toBeInTheDocument();
    expect(within(list).getByRole("option", { name: /Venezuela\s*\+58/ })).toHaveAttribute("aria-selected", "true");
  });

  it("busca por nombre (sin tildes) o por número y elige con un clic", () => {
    const { trigger, onChange } = setup();
    fireEvent.click(trigger);
    const search = screen.getByRole("textbox", { name: "Buscar país o prefijo" });

    fireEvent.change(search, { target: { value: "peru" } });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["🇵🇪Perú+51"]);

    fireEvent.change(search, { target: { value: "+59" } });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["🇪🇨Ecuador+593", "🇧🇴Bolivia+591", "🇵🇾Paraguay+595", "🇺🇾Uruguay+598"]);

    fireEvent.click(screen.getByRole("option", { name: /Bolivia/ }));
    expect(onChange).toHaveBeenCalledWith("591");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("con el teclado: flechas y Enter eligen; Escape cierra solo la lista", () => {
    const { trigger, onChange } = setup();
    fireEvent.click(trigger);
    const search = screen.getByRole("textbox", { name: "Buscar país o prefijo" });
    fireEvent.change(search, { target: { value: "m" } });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger);
    // El editor se cierra con Escape en `window`: este Escape no debe llegarle.
    const windowListener = vi.fn();
    window.addEventListener("keydown", windowListener);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Buscar país o prefijo" }), { key: "Escape" });
    window.removeEventListener("keydown", windowListener);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(windowListener).not.toHaveBeenCalled();
  });
});
