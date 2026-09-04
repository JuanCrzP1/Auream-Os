import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MessageEditor } from "@features/automations/builder/tools/message/MessageEditor";
import { createMessageItem } from "@features/automations/builder/tools/message/messageItems";
import { readMessageItems } from "@features/automations/builder/tools/message/readMessageConfig";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";

// ---------------------------------------------------------------------------
// «Enviar una sola vez» y el bloque Intervalo.
//
// El switch es lo único de esta pasada que toca el MODELO: su estado se guarda
// en la configuración del bloque. Por eso lo que más se prueba aquí no es que
// se pinte, sino que el dato viaje —y que siga siendo el mismo al releerlo—.
// ---------------------------------------------------------------------------

const MEDIOS = ["image", "video", "audio", "file"] as const;

/** Cierra el bucle configuración → editor → configuración, como el nodo real. */
function Conectado({ inicial }: { inicial: Record<string, unknown> }) {
  const [config, setConfig] = useState(inicial);

  return (
    <MessageEditor
      draft={{ name: "M", content: {}, config }}
      onChange={(patch: NodePatch) => {
        if (patch.config) setConfig(patch.config);
      }}
    />
  );
}

function renderMedio(kind: string, sendOnce = false) {
  const onChange = vi.fn<(patch: NodePatch) => void>();

  const utils = render(
    <MessageEditor
      draft={{
        name: "M",
        content: {},
        config: { items: [{ id: "x", kind, url: "", caption: "", sendOnce }] }
      }}
      onChange={onChange}
    />
  );

  const lastItems = () =>
    (onChange.mock.lastCall?.[0].config?.items ?? []) as Array<Record<string, unknown>>;

  return { ...utils, onChange, lastItems };
}

const conmutador = () => screen.getByRole("switch", { name: "Enviar una sola vez" });

describe("«Enviar una sola vez» — los cuatro tipos multimedia", () => {
  it.each(MEDIOS)("%s lo ofrece", (kind) => {
    renderMedio(kind);

    expect(conmutador()).toBeTruthy();
  });

  it.each(MEDIOS)("%s nace apagado", (kind) => {
    renderMedio(kind);

    expect(conmutador().getAttribute("aria-checked")).toBe("false");
  });

  it("es un interruptor, no una casilla", () => {
    const { container } = renderMedio("image");

    // Una casilla se lee como «una opción de una lista»; esto es un estado del
    // bloque que se enciende y se apaga, y el control tiene que decirlo.
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(conmutador().getAttribute("role")).toBe("switch");
  });

  it("un bloque nuevo nace con el dato en falso, no ausente", () => {
    const nuevo = createMessageItem("video");

    expect(nuevo).toMatchObject({ kind: "video", sendOnce: false });
  });
});

describe("el estado del switch SÍ se guarda", () => {
  it("encenderlo escribe en la configuración del bloque", () => {
    const { lastItems } = renderMedio("image");

    fireEvent.click(conmutador());

    expect(lastItems()[0]).toMatchObject({ kind: "image", sendOnce: true });
  });

  it("apagarlo también", () => {
    const { lastItems } = renderMedio("audio", true);

    fireEvent.click(conmutador());

    expect(lastItems()[0]).toMatchObject({ sendOnce: false });
  });

  it("se refleja en la interfaz tras el ciclo completo", () => {
    render(<Conectado inicial={{ items: [createMessageItem("file")] }} />);

    fireEvent.click(conmutador());

    expect(conmutador().getAttribute("aria-checked")).toBe("true");
  });

  it("sobrevive a releer la configuración, que es lo que hace el nodo", () => {
    const leidos = readMessageItems(
      { items: [{ id: "x", kind: "image", url: "", caption: "", sendOnce: true }] },
      {}
    );

    expect(leidos[0]).toMatchObject({ kind: "image", sendOnce: true });
  });

  it("un bloque guardado sin el campo se lee como apagado, no como roto", () => {
    const leidos = readMessageItems({ items: [{ id: "x", kind: "image", url: "" }] }, {});

    expect(leidos[0]).toMatchObject({ kind: "image", sendOnce: false });
  });

  it("no se cuela en los tipos que no son multimedia", () => {
    render(
      <MessageEditor
        draft={{ name: "M", content: {}, config: { items: [createMessageItem("text")] } }}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByRole("switch")).toBeNull();
  });
});

describe("bloque Intervalo", () => {
  function renderIntervalo(amount = 5, unit = "seconds") {
    const onChange = vi.fn<(patch: NodePatch) => void>();

    const utils = render(
      <MessageEditor
        draft={{ name: "M", content: {}, config: { items: [{ id: "i", kind: "interval", amount, unit }] } }}
        onChange={onChange}
      />
    );

    const lastItems = () =>
      (onChange.mock.lastCall?.[0].config?.items ?? []) as Array<Record<string, unknown>>;

    return { ...utils, onChange, lastItems };
  }

  // El rótulo visible «Pausa antes del siguiente bloque» se retiró: repetía lo
  // que ya dicen la cabecera del bloque y el propio valor, y costaba una fila
  // entera justo en el bloque que existe para ser el más corto del editor.
  // Lo que NO puede perderse es que cada control siga diciendo qué es, en
  // castellano y sin jerga — para un lector de pantalla eso es todo el
  // contexto que hay, así que ahora se comprueban los tres.
  it("cada control dice para qué sirve, sin jerga", () => {
    renderIntervalo();

    expect(screen.getByLabelText("Duración de la pausa del bloque 1")).toBeTruthy();
    expect(screen.getByLabelText("Unidad de la pausa del bloque 1")).toBeTruthy();
    expect(screen.getByLabelText("Ajustar la duración de la pausa del bloque 1")).toBeTruthy();
  });

  it("ya no gasta una fila en repetir lo que dicen la cabecera y el valor", () => {
    renderIntervalo();

    expect(screen.queryByText("Pausa antes del siguiente bloque")).toBeNull();
  });

  it("tiene cantidad y unidad", () => {
    renderIntervalo(15);

    const cantidad = screen.getByLabelText("Duración de la pausa del bloque 1") as HTMLInputElement;

    expect(cantidad.value).toBe("15");
    // La unidad ya no es un `<select>`: su menú lo pintaba el sistema
    // operativo y no había forma de que siguiera el tema. Ahora es un
    // disparador propio que enseña la unidad vigente.
    expect(screen.getByLabelText("Unidad de la pausa del bloque 1").textContent).toContain(
      "segundos"
    );
  });

  it("el menú de unidades no se despliega hasta que se pide", () => {
    renderIntervalo();

    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.click(screen.getByLabelText("Unidad de la pausa del bloque 1"));

    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "segundos",
      "minutos",
      "horas"
    ]);
  });

  it("elegir una unidad la guarda y cierra el menú", () => {
    const { lastItems } = renderIntervalo();

    fireEvent.click(screen.getByLabelText("Unidad de la pausa del bloque 1"));
    fireEvent.click(screen.getByRole("option", { name: "minutos" }));

    expect(lastItems()[0]).toMatchObject({ unit: "minutes" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("señala cuál es la unidad vigente dentro del menú", () => {
    renderIntervalo(10, "minutes");

    fireEvent.click(screen.getByLabelText("Unidad de la pausa del bloque 1"));

    expect(screen.getByRole("option", { name: "minutos" }).getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(screen.getByRole("option", { name: "horas" }).getAttribute("aria-selected")).toBe(
      "false"
    );
  });

  it("Escape cierra el menú sin cambiar nada", () => {
    const { lastItems } = renderIntervalo(10, "seconds");

    fireEvent.click(screen.getByLabelText("Unidad de la pausa del bloque 1"));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(lastItems()[0] ?? { unit: "seconds" }).toMatchObject({ unit: "seconds" });
  });

  // Se quitaron los atajos 3s/10s/30s/1min: entre el número, la unidad y el
  // deslizador la duración ya se fija en un gesto, y este bloque tiene que ser
  // el más compacto del editor.
  it("no lleva atajos: el bloque se mantiene mínimo", () => {
    renderIntervalo();

    for (const etiqueta of ["3s", "10s", "30s", "1min"]) {
      expect(screen.queryByRole("button", { name: etiqueta })).toBeNull();
    }
  });

  it("el deslizador escribe en el mismo dato que el campo numérico", () => {
    const { lastItems } = renderIntervalo(5, "seconds");

    fireEvent.change(screen.getByLabelText("Ajustar la duración de la pausa del bloque 1"), {
      target: { value: "42" }
    });

    expect(lastItems()[0]).toMatchObject({ amount: 42, unit: "seconds" });
  });

  it("no acepta una pausa de cero", () => {
    const { lastItems } = renderIntervalo();

    fireEvent.change(screen.getByLabelText("Duración de la pausa del bloque 1"), {
      target: { value: "0" }
    });

    expect(lastItems()[0]).toMatchObject({ amount: 1 });
  });

  it("no tiene pestañas ni switch: no es multimedia", () => {
    renderIntervalo();

    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("sigue la misma estructura que el resto: cuerpo con rótulo y controles", () => {
    const { container } = renderIntervalo();

    // Mismo contenedor de cuerpo que Texto y multimedia: la identidad cambia
    // por color e icono, no por estructura.
    expect(container.querySelector(".message-item--interval .message-item__body")).not.toBeNull();
    expect(container.querySelector(".message-item--interval .message-item__icon")).not.toBeNull();
  });
});

describe("estructura común a todos los bloques", () => {
  const todos = ["text", "image", "video", "audio", "file", "interval"] as const;

  it("cabecera con icono y cuerpo, en los seis", () => {
    for (const kind of todos) {
      const { container, unmount } = render(
        <MessageEditor
          draft={{ name: "M", content: {}, config: { items: [createMessageItem(kind)] } }}
          onChange={vi.fn()}
        />
      );

      const bloque = container.querySelector(`.message-item--${kind}`)!;
      expect(bloque.querySelector(".message-item__bar")).not.toBeNull();
      expect(bloque.querySelector(".message-item__icon svg")).not.toBeNull();
      expect(bloque.querySelector(".message-item__body")).not.toBeNull();
      expect(bloque.querySelector(".message-item__grip")).not.toBeNull();
      unmount();
    }
  });

  it("los cuatro controles en los seis", () => {
    for (const kind of todos) {
      const { unmount } = render(
        <MessageEditor
          draft={{ name: "M", content: {}, config: { items: [createMessageItem(kind)] } }}
          onChange={vi.fn()}
        />
      );

      for (const accion of [/^Subir/, /^Bajar/, /^Duplicar/, /^Eliminar/]) {
        expect(screen.getByRole("button", { name: accion })).toBeTruthy();
      }
      unmount();
    }
  });
});
