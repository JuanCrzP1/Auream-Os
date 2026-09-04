import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MessageEditor } from "@features/automations/builder/tools/message/MessageEditor";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";

// ---------------------------------------------------------------------------
// Selector de origen del archivo: Archivo / URL.
//
// Lo comparten los cuatro tipos multimedia. Lo que se fija aquí es que sea el
// MISMO comportamiento en los cuatro, que Archivo sea siempre el punto de
// partida, y —lo más importante— que la pestaña NO llegue nunca a la
// configuración del nodo: es estado de la sesión de edición, no parte de lo que
// el mensaje dice.
// ---------------------------------------------------------------------------

const MEDIOS = ["image", "video", "audio", "file"] as const;

const ACCION: Record<string, string> = {
  image: "Seleccionar imagen",
  video: "Seleccionar video",
  audio: "Seleccionar audio",
  file: "Seleccionar archivo"
};

function renderBloque(kind: string, url = "", caption = "") {
  const onChange = vi.fn<(patch: NodePatch) => void>();

  const utils = render(
    <MessageEditor
      draft={{ name: "Mensaje", content: {}, config: { items: [{ id: "x", kind, url, caption }] } }}
      onChange={onChange}
    />
  );

  const lastItems = () =>
    (onChange.mock.lastCall?.[0].config?.items ?? []) as Array<Record<string, unknown>>;

  return { ...utils, onChange, lastItems };
}

const tab = (nombre: "Archivo" | "URL") => screen.getByRole("tab", { name: nombre });

describe("las dos pestañas existen en los cuatro tipos multimedia", () => {
  it.each(MEDIOS)("%s ofrece Archivo y URL", (kind) => {
    renderBloque(kind);

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(tab("Archivo")).toBeTruthy();
    expect(tab("URL")).toBeTruthy();
  });

  it.each(MEDIOS)("%s arranca en Archivo, nunca en URL", (kind) => {
    renderBloque(kind);

    expect(tab("Archivo").getAttribute("aria-selected")).toBe("true");
    expect(tab("URL").getAttribute("aria-selected")).toBe("false");
  });

  it.each(MEDIOS)("%s hereda el acento de su tipo", (kind) => {
    const { container } = renderBloque(kind);

    // El color no lo pone el selector: lo hereda del bloque, que es quien
    // declara `--mi-accent`. Si esta cadena se rompe, las cuatro pestañas se
    // verían del mismo color.
    const bloque = container.querySelector(`.message-item--${kind}`);
    expect(bloque?.querySelector(".media-tabs")).not.toBeNull();
  });
});

describe("cambiar de pestaña", () => {
  it("URL muestra el campo de enlace y esconde la zona de archivo", () => {
    const { container } = renderBloque("image");

    fireEvent.click(tab("URL"));

    expect(screen.getByLabelText("URL del archivo del bloque 1")).toBeTruthy();
    expect(container.querySelector(".media-file")).toBeNull();
  });

  it("Archivo vuelve a la zona de carga y esconde el campo", () => {
    const { container } = renderBloque("image");

    fireEvent.click(tab("URL"));
    fireEvent.click(tab("Archivo"));

    expect(container.querySelector(".media-file")).not.toBeNull();
    expect(screen.queryByLabelText("URL del archivo del bloque 1")).toBeNull();
  });

  it("nunca se ven las dos a la vez", () => {
    const { container } = renderBloque("video");

    expect(container.querySelectorAll(".media-file, .media-url")).toHaveLength(1);

    fireEvent.click(tab("URL"));
    expect(container.querySelectorAll(".media-file, .media-url")).toHaveLength(1);
  });

  it("la pestaña activa se refleja en aria-selected", () => {
    renderBloque("audio");

    fireEvent.click(tab("URL"));

    expect(tab("URL").getAttribute("aria-selected")).toBe("true");
    expect(tab("Archivo").getAttribute("aria-selected")).toBe("false");
  });
});

describe("la pestaña NO es configuración del flujo", () => {
  it("cambiar de pestaña no escribe nada en el nodo", () => {
    const { onChange } = renderBloque("file");

    fireEvent.click(tab("URL"));
    fireEvent.click(tab("Archivo"));
    fireEvent.click(tab("URL"));

    // Ni una sola escritura: qué pestaña miraba el usuario no forma parte de
    // lo que su mensaje dice, y guardarlo ensuciaría el snapshot.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("el enlace escrito sí llega al nodo", () => {
    const { lastItems } = renderBloque("image");

    fireEvent.click(tab("URL"));
    fireEvent.change(screen.getByLabelText("URL del archivo del bloque 1"), {
      target: { value: "https://cdn.test/foto.png" }
    });

    expect(lastItems()[0]).toMatchObject({ kind: "image", url: "https://cdn.test/foto.png" });
  });

  it("el enlace ya guardado sobrevive a ir y volver entre pestañas", () => {
    renderBloque("image", "https://cdn.test/foto.png");

    fireEvent.click(tab("URL"));
    fireEvent.click(tab("Archivo"));
    fireEvent.click(tab("URL"));

    const campo = screen.getByLabelText("URL del archivo del bloque 1") as HTMLInputElement;
    expect(campo.value).toBe("https://cdn.test/foto.png");
  });
});

describe("zona de archivo", () => {
  it.each(MEDIOS)("%s nombra su acción con su propio tipo", (kind) => {
    renderBloque(kind);

    expect(screen.getByLabelText(`${ACCION[kind]} del bloque 1`)).toBeTruthy();
    expect(screen.getByRole("button", { name: ACCION[kind] })).toBeTruthy();
  });

  it("explica las dos formas de traer el archivo", () => {
    renderBloque("image");

    expect(screen.getByText(/Arrastra el archivo o búscalo en tu dispositivo/)).toBeTruthy();
  });

  // La zona llegó a decir su acción DOS VECES —un título y, dos centímetros
  // más abajo, el botón con el mismo texto—. Repetirlo no informaba de nada y
  // costaba alto en la tarjeta. Vale para los cuatro tipos: el texto sale del
  // mismo mapa, así que si el título vuelve, vuelve en todos.
  it.each(MEDIOS)("%s dice su acción una sola vez, en el botón", (kind) => {
    renderBloque(kind);

    expect(screen.getAllByText(ACCION[kind])).toHaveLength(1);
    expect(screen.getByRole("button", { name: ACCION[kind] })).toBeTruthy();
  });

  it("reacciona a un archivo del escritorio sobrevolando", () => {
    const { container } = renderBloque("video");

    const zona = container.querySelector(".media-file")!;
    fireEvent.dragOver(zona);

    expect(zona.className).toContain("media-file--receiving");
    expect(screen.getByText("Suelta aquí")).toBeTruthy();
  });

  it("el input acepta el tipo que corresponde", () => {
    const { container } = renderBloque("audio");

    expect(container.querySelector<HTMLInputElement>(".media-file__input")?.accept).toBe("audio/*");
  });

  it("Archivo no restringe el tipo: es cualquier documento", () => {
    const { container } = renderBloque("file");

    expect(container.querySelector<HTMLInputElement>(".media-file__input")?.accept).toBe("");
  });
});

describe("campo de enlace", () => {
  it("señala un enlace que no es una URL", () => {
    // El campo lo controla la configuración del nodo, así que se parte de un
    // enlace ya guardado que no vale — que es como llegaría desde un flujo
    // editado a mano.
    renderBloque("image", "esto no es una url");

    fireEvent.click(tab("URL"));

    expect(screen.getByText(/Debe empezar por http/)).toBeTruthy();
    expect(
      screen.getByLabelText("URL del archivo del bloque 1").getAttribute("aria-invalid")
    ).toBe("true");
  });

  it("un enlace correcto no se marca como error", () => {
    renderBloque("image", "https://cdn.test/foto.png");

    fireEvent.click(tab("URL"));

    expect(screen.queryByText(/Debe empezar por http/)).toBeNull();
    expect(
      screen.getByLabelText("URL del archivo del bloque 1").getAttribute("aria-invalid")
    ).toBe("false");
  });

  it("vacío no es un error: todavía no se ha pegado nada", () => {
    renderBloque("image");

    fireEvent.click(tab("URL"));

    expect(screen.queryByText(/Debe empezar por http/)).toBeNull();
  });

  it("un enlace válido muestra el nombre del archivo", () => {
    renderBloque("file", "https://cdn.test/docs/condiciones.pdf");

    fireEvent.click(tab("URL"));

    expect(screen.getByText("condiciones.pdf")).toBeTruthy();
  });

  it("solo Imagen muestra miniatura", () => {
    const conImagen = renderBloque("image", "https://cdn.test/foto.png");
    fireEvent.click(tab("URL"));
    expect(conImagen.container.querySelector(".media-url__thumb")).not.toBeNull();
    conImagen.unmount();

    const conVideo = renderBloque("video", "https://cdn.test/clip.mp4");
    fireEvent.click(tab("URL"));
    expect(conVideo.container.querySelector(".media-url__thumb")).toBeNull();
  });
});

describe("los tipos que no son multimedia no tienen pestañas", () => {
  it("Texto conserva su editor", () => {
    render(
      <MessageEditor
        draft={{ name: "M", content: {}, config: { items: [{ id: "t", kind: "text", text: "" }] } }}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.getByLabelText("Texto del bloque 1")).toBeTruthy();
  });

  it("Intervalo conserva el suyo", () => {
    render(
      <MessageEditor
        draft={{
          name: "M",
          content: {},
          config: { items: [{ id: "i", kind: "interval", amount: 5, unit: "seconds" }] }
        }}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.getByLabelText("Duración de la pausa del bloque 1")).toBeTruthy();
  });
});

describe("consistencia entre los cuatro", () => {
  it("todos usan el mismo control, no cuatro implementaciones", () => {
    for (const kind of MEDIOS) {
      const { container, unmount } = renderBloque(kind);

      const tabs = container.querySelector(".media-tabs") as HTMLElement;
      expect(within(tabs).getAllByRole("tab")).toHaveLength(2);
      expect(container.querySelector(".media-file")).not.toBeNull();
      unmount();
    }
  });
});
