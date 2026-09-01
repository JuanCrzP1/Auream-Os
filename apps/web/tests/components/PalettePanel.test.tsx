import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PalettePanel } from "../../src/features/automations/builder/components/panels/PalettePanel";
import { listPaletteTools } from "../../src/features/automations/builder/tools/registry";

// ---------------------------------------------------------------------------
// La paleta es un consumidor del registry: no declara herramientas propias.
//
// Por eso estos tests se apoyan en `listPaletteTools()` en lugar de repetir la
// lista: si mañana se añade una herramienta al registry, la paleta debe
// mostrarla sin que haya que tocar este archivo. Eso es justo lo que se valida.
// ---------------------------------------------------------------------------

function renderPalette(onAddNode = vi.fn()) {
  return render(<PalettePanel onAddNode={onAddNode} />);
}

/** El icono de la marca es el único control de plegado, en ambos estados. */
function toggle() {
  return screen.getByRole("button", { name: /(abrir|contraer) herramientas/i });
}

describe("PalettePanel — estado de plegado", () => {
  it("arranca recogida: al entrar al builder manda el lienzo, no la lista", () => {
    renderPalette();

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle()).toHaveAccessibleName(/abrir herramientas/i);
  });

  it("el clic en el icono la despliega", async () => {
    renderPalette();
    await userEvent.click(toggle());

    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(toggle()).toHaveAccessibleName(/contraer herramientas/i);
  });

  it("un segundo clic vuelve a recogerla", async () => {
    renderPalette();
    await userEvent.click(toggle());
    await userEvent.click(toggle());

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("el control sigue siendo el mismo icono: nunca hay dos", async () => {
    renderPalette();

    // Un único control de plegado, tanto recogida como desplegada.
    expect(screen.getAllByRole("button", { name: /(abrir|contraer) herramientas/i })).toHaveLength(1);

    await userEvent.click(toggle());

    expect(screen.getAllByRole("button", { name: /(abrir|contraer) herramientas/i })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /expandir|desplegar/i })).not.toBeInTheDocument();
  });
});

describe("PalettePanel", () => {
  it("muestra todas las herramientas que el registry ofrece", () => {
    renderPalette();

    for (const tool of listPaletteTools()) {
      expect(
        screen.getByRole("button", { name: new RegExp(tool.label, "i") }),
        `la paleta no muestra '${tool.label}'`
      ).toBeInTheDocument();
    }
  });

  it("no muestra las herramientas retiradas ni el nodo de sistema", () => {
    renderPalette();

    for (const retirada of [/captura/i, /^acción$/i, /fallback/i, /finalizar/i]) {
      expect(screen.queryByRole("button", { name: retirada })).not.toBeInTheDocument();
    }
  });

  it("filtra por búsqueda sobre etiqueta y descripción", async () => {
    renderPalette();
    const total = listPaletteTools().length;

    await userEvent.type(screen.getByPlaceholderText(/buscar bloque/i), "etiquet");

    const visibles = screen.getAllByRole("button").filter((button) =>
      button.classList.contains("palette-block")
    );

    expect(visibles.length).toBeGreaterThan(0);
    expect(visibles.length).toBeLessThan(total);
    expect(screen.getByRole("button", { name: /etiquetas/i })).toBeInTheDocument();
  });

  it("pide añadir la herramienta que se pulsa", async () => {
    const onAddNode = vi.fn();
    renderPalette(onAddNode);

    await userEvent.click(screen.getByRole("button", { name: /distribuidor/i }));

    expect(onAddNode).toHaveBeenCalledWith("distributor");
  });

  it("expone cada herramienta como arrastrable al canvas", () => {
    renderPalette();

    const bloques = screen
      .getAllByRole("button")
      .filter((button) => button.classList.contains("palette-block"));

    expect(bloques).toHaveLength(listPaletteTools().length);
    for (const bloque of bloques) {
      expect(bloque).toHaveAttribute("draggable", "true");
    }
  });
});
