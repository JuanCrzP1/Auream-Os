import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MessageEditor } from "@features/automations/builder/tools/message/MessageEditor";
import { readMessageItems } from "@features/automations/builder/tools/message/readMessageConfig";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";

// ---------------------------------------------------------------------------
// «Ver una sola vez» (como en Leona): en la imagen, el video y el audio; un
// archivo no lo ofrece porque WhatsApp no lo permite. El dato se guarda en el
// bloque y sobrevive al releerlo.
// ---------------------------------------------------------------------------

function renderMedio(kind: string, viewOnce?: boolean) {
  const onChange = vi.fn<(patch: NodePatch) => void>();
  render(
    <MessageEditor
      draft={{ name: "M", content: {}, config: { items: [{ id: "x", kind, url: "", caption: "", sendOnce: false, ...(viewOnce ? { viewOnce } : {}) }] } }}
      onChange={onChange}
    />
  );
  const lastItems = () => (onChange.mock.lastCall?.[0].config?.items ?? []) as Array<Record<string, unknown>>;
  return { onChange, lastItems };
}

const verUnaVez = () => screen.queryByRole("switch", { name: "Ver una sola vez" });

describe("«Ver una sola vez»", () => {
  it.each(["image", "video", "audio"])("%s lo ofrece, apagado y con su explicación", (kind) => {
    renderMedio(kind);
    expect(verUnaVez()?.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("El cliente lo abre una vez y se borra del chat.")).toBeTruthy();
  });

  it("un archivo no lo ofrece", () => {
    renderMedio("file");
    expect(verUnaVez()).toBeNull();
    expect(screen.getByRole("switch", { name: "Enviar una sola vez" })).toBeTruthy();
  });

  it("encenderlo lo guarda en el bloque y se relee igual", () => {
    const { lastItems } = renderMedio("audio");
    fireEvent.click(verUnaVez()!);
    expect(lastItems()[0]).toMatchObject({ kind: "audio", viewOnce: true, sendOnce: false });
    expect(readMessageItems({ items: lastItems() }, {})[0]).toMatchObject({ viewOnce: true });
  });

  it("ya encendido se muestra encendido", () => {
    renderMedio("video", true);
    expect(verUnaVez()?.getAttribute("aria-checked")).toBe("true");
  });
});
