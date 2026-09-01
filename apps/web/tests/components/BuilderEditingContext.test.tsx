import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  BuilderEditingProvider,
  useBuilderEditing
} from "../../src/features/automations/builder/context/BuilderEditingContext";

// ---------------------------------------------------------------------------
// Frontera de edición del builder.
//
// Sustituye a un singleton mutable de módulo (`editCallbackStore`). Los tests
// se centran en lo que aquel no podía cumplir: aislamiento entre instancias y
// fallo explícito cuando falta el provider.
// ---------------------------------------------------------------------------

/** Consumidor mínimo: hace lo mismo que una tarjeta del lienzo. */
function TarjetaFalsa({ id }: { id: string }) {
  const { requestEdit, removeNode } = useBuilderEditing();

  return (
    <>
      <button type="button" onClick={() => requestEdit(id)}>{`editar ${id}`}</button>
      <button type="button" onClick={() => removeNode(id)}>{`eliminar ${id}`}</button>
    </>
  );
}

describe("BuilderEditingContext", () => {
  it("entrega las operaciones al consumidor", async () => {
    const requestEdit = vi.fn();
    const removeNode = vi.fn();

    render(
      <BuilderEditingProvider requestEdit={requestEdit} removeNode={removeNode}>
        <TarjetaFalsa id="n1" />
      </BuilderEditingProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "editar n1" }));
    await userEvent.click(screen.getByRole("button", { name: "eliminar n1" }));

    expect(requestEdit).toHaveBeenCalledWith("n1");
    expect(removeNode).toHaveBeenCalledWith("n1");
  });

  it("dos builders montados a la vez no comparten operaciones", async () => {
    // Esto es exactamente lo que el singleton de módulo no podía hacer: había
    // una sola variable, así que el segundo builder pisaba al primero.
    const removeA = vi.fn();
    const removeB = vi.fn();

    render(
      <>
        <BuilderEditingProvider requestEdit={vi.fn()} removeNode={removeA}>
          <TarjetaFalsa id="a" />
        </BuilderEditingProvider>
        <BuilderEditingProvider requestEdit={vi.fn()} removeNode={removeB}>
          <TarjetaFalsa id="b" />
        </BuilderEditingProvider>
      </>
    );

    await userEvent.click(screen.getByRole("button", { name: "eliminar a" }));

    expect(removeA).toHaveBeenCalledWith("a");
    expect(removeB).not.toHaveBeenCalled();
  });

  it("desmontar un builder no deja operaciones vivas de otro", async () => {
    const removeA = vi.fn();
    const { unmount } = render(
      <BuilderEditingProvider requestEdit={vi.fn()} removeNode={removeA}>
        <TarjetaFalsa id="a" />
      </BuilderEditingProvider>
    );

    unmount();

    const removeB = vi.fn();
    render(
      <BuilderEditingProvider requestEdit={vi.fn()} removeNode={removeB}>
        <TarjetaFalsa id="b" />
      </BuilderEditingProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "eliminar b" }));

    expect(removeB).toHaveBeenCalledWith("b");
    expect(removeA).not.toHaveBeenCalled();
  });

  it("falla de forma explícita si se usa fuera del provider", () => {
    // Sin provider no hay a quién pedir la operación. Es preferible el error a
    // un botón que no hace nada: silenciarlo es justo lo que se está quitando.
    const silenciarError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<TarjetaFalsa id="huerfana" />)).toThrow(/BuilderEditingProvider/);

    silenciarError.mockRestore();
  });
});
