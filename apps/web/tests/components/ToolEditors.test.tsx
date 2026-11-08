import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NodeExpandedFrame } from "@features/automations/builder/components/canvas/NodeExpandedFrame";
import { createNodeDraft } from "@features/automations/builder/services/createNodeDraft";
import { resolveTool } from "@features/automations/builder/tools/registry";
import { resolveToolUi } from "@features/automations/builder/tools/ui-registry";
import type { NodeType } from "@contracts/FlowSnapshot";

const NEW_EDITORS: ReadonlyArray<NodeType> = [
  "tags",
  "notification",
  "pixel",
  "integration",
  "condition",
  "menu",
  "ai",
  "payment-proof"
];

function mount(type: NodeType, onCommit = vi.fn()) {
  const node = createNodeDraft(type, 0);
  render(
    <NodeExpandedFrame data={node.data} tool={resolveTool(type)} ui={resolveToolUi(type)} onCommit={onCommit} onClose={() => {}} />
  );
  return onCommit;
}

describe("editores de las herramientas", () => {
  it.each(NEW_EDITORS)("%s monta su editor propio dentro del marco", (type) => {
    mount(type);
    expect(screen.queryByText("Esta herramienta todavía no tiene configuración propia.")).toBeNull();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it("Etiquetas: añadir una etiqueta y guardar la escribe en la configuración", () => {
    const onCommit = mount("tags");
    const input = screen.getByLabelText("Etiquetas a agregar");

    fireEvent.change(input, { target: { value: "vip" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ tags: ["vip"] }) }));
  });

  it("Menú: sin opciones no deja guardar y explica por qué", () => {
    const onCommit = mount("menu");
    fireEvent.click(screen.getByRole("radio", { name: "Botones" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Añade al menos una opción.");
  });

  it("Menú: en botones, «Añadir opción» se desactiva al llegar a 3", () => {
    mount("menu");
    fireEvent.click(screen.getByRole("radio", { name: "Botones" }));
    // Vacío, el botón vive en el estado vacío; luego, bajo la lista: se busca cada vez.
    const add = () => screen.getByRole("button", { name: "Añadir opción" });

    fireEvent.click(add());
    fireEvent.click(add());
    fireEvent.click(add());

    expect(screen.getAllByLabelText(/Título de la opción/)).toHaveLength(3);
    expect(add()).toBeDisabled();
  });

  it("Condicional: cambiar la categoría de una regla cambia sus operadores", () => {
    mount("condition");
    fireEvent.click(screen.getByRole("button", { name: "Añadir regla" }));
    fireEvent.change(screen.getByLabelText("Qué evalúa la regla 1"), { target: { value: "messageWindow" } });

    const operator = screen.getByLabelText("Operador de la regla 1") as HTMLSelectElement;
    expect([...operator.options].map((option) => option.value)).toEqual(["open", "closed"]);
    expect(screen.queryByLabelText("Valor de la regla 1")).toBeNull();
  });

  it("Integración: GET oculta el cuerpo de la petición", () => {
    mount("integration");
    expect(screen.getByLabelText("Contenido (JSON o texto)")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Método"), { target: { value: "GET" } });
    expect(screen.queryByLabelText("Contenido (JSON o texto)")).toBeNull();
  });

  it("Comprobante: registrar una cuenta muestra cómo se reconoce en el comprobante", () => {
    const onCommit = mount("payment-proof");
    expect(screen.getByText("Aún no registras cuentas")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Añadir cuenta" }));
    fireEvent.change(screen.getByLabelText("Banco o billetera de la cuenta 1"), { target: { value: "co-nequi" } });
    expect((screen.getByLabelText("Tipo de la cuenta 1") as HTMLSelectElement).value).toBe("wallet");

    fireEvent.change(screen.getByLabelText("Número de celular"), { target: { value: "3001234567" } });
    fireEvent.change(screen.getByLabelText("Titular"), { target: { value: "Auream SAS" } });
    expect(screen.getByText("Así la reconocemos en el comprobante")).toBeInTheDocument();
    expect(screen.getByText("••••4567", { exact: false })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          accounts: [expect.objectContaining({ country: "CO", provider: "co-nequi", number: "3001234567", holder: "Auream SAS" })]
        })
      })
    );
  });

  it("Comprobante: cambiar el país de una cuenta cambia sus entidades y tipos", () => {
    mount("payment-proof");
    fireEvent.click(screen.getByRole("button", { name: "Añadir cuenta" }));
    fireEvent.change(screen.getByLabelText("País de la cuenta 1"), { target: { value: "MX" } });

    const types = screen.getByLabelText("Tipo de la cuenta 1") as HTMLSelectElement;
    expect(types.value).toBe("clabe");
    expect(screen.getByLabelText("CLABE (18 dígitos)")).toBeInTheDocument();
    expect(screen.getByLabelText("RFC del titular (opcional)")).toBeInTheDocument();
  });

  it("Comprobante: verificar el monto abre su campo y su salida", () => {
    mount("payment-proof");
    fireEvent.click(screen.getByRole("radio", { name: "Monto mínimo" }));

    expect(screen.getByLabelText("Monto esperado")).toBeInTheDocument();
    expect(screen.getByText("Monto incorrecto")).toBeInTheDocument();
  });
});
