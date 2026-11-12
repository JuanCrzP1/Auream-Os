import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { QuickReply } from "@contracts/QuickReplyContracts";
import { QuickRepliesSettings } from "../../src/features/conversations/quick-replies/QuickRepliesSettings";
import { QUICK_REPLIES } from "../helpers/conversationsApi";

// ---------------------------------------------------------------------------
// Configuración › Respuestas rápidas: el catálogo por categorías con su uso;
// dueños y administradores crean (con vista previa), duplican y borran; el
// resto solo las ve.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

function stub(canManage: boolean) {
  const replies: QuickReply[] = [...QUICK_REPLIES];
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    if (url.pathname === "/quick-replies" && method === "GET") return reply(200, { quickReplies: replies, canManage });
    if (url.pathname === "/quick-replies" && method === "POST") {
      const body = JSON.parse(String(init!.body)) as Pick<QuickReply, "shortcut" | "category" | "pieces">;
      const created: QuickReply = { id: `q${replies.length + 1}`, useCount: 0, lastUsedAt: null, createdAt: "", updatedAt: "", ...body };
      replies.push(created);
      return reply(201, created);
    }
    if (url.pathname.startsWith("/quick-replies/") && method === "DELETE") return reply(204);
    return reply(404, {});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const page = () => render(<MemoryRouter><QuickRepliesSettings /></MemoryRouter>);

beforeEach(() => vi.restoreAllMocks());

describe("Configuración › Respuestas rápidas", () => {
  it("agrupa por categoría, muestra el uso y filtra", async () => {
    stub(true);
    page();
    const saludos = await screen.findByRole("region", { name: "Saludos" });
    expect(within(saludos).getByText("/saludo")).toBeInTheDocument();
    expect(within(saludos).getByText("Usada 3 veces")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Precios" })).getByText("Sin usar aún")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Precios · 1" }));
    expect(screen.queryByRole("region", { name: "Saludos" })).not.toBeInTheDocument();
  });

  it("crear: atajo, categoría y texto, con la vista previa como en WhatsApp", async () => {
    const fetchMock = stub(true);
    page();
    await userEvent.click(await screen.findByRole("button", { name: "+ Nueva respuesta" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva respuesta rápida" });
    await userEvent.type(within(dialog).getByPlaceholderText("saludo"), "envios");
    await userEvent.type(within(dialog).getByPlaceholderText("Saludos, Precios, Pagos…"), "Envíos");
    await userEvent.type(within(dialog).getByLabelText("Texto de la pieza 1"), "Hola {{nombre}, enviamos a todo el país");
    expect(within(dialog).getByRole("complementary", { name: "Vista previa en WhatsApp" })).toHaveTextContent("Hola María, enviamos a todo el país");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear respuesta" }));

    expect(await screen.findByRole("region", { name: "Envíos" })).toHaveTextContent("/envios");
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({ shortcut: "envios", category: "Envíos", pieces: [{ kind: "text", text: "Hola {nombre}, enviamos a todo el país" }] });
  });

  it("duplicar abre el editor con la copia y un atajo libre; borrar pide confirmación", async () => {
    const fetchMock = stub(true);
    page();
    await userEvent.click(await screen.findByRole("button", { name: "Duplicar /saludo" }));
    const dialog = screen.getByRole("dialog", { name: "Duplicar respuesta rápida" });
    expect(within(dialog).getByPlaceholderText("saludo")).toHaveValue("saludo-copia");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await userEvent.click(screen.getByRole("button", { name: "Borrar /precios" }));
    await userEvent.click(within(await screen.findByRole("alertdialog", { name: "¿Borrar /precios?" })).getByRole("button", { name: "Borrar" }));
    await vi.waitFor(() => expect(screen.queryByText("/precios")).not.toBeInTheDocument());
    expect(fetchMock.mock.calls.some(([u, init]) => String(u).endsWith("/quick-replies/q2") && init?.method === "DELETE")).toBe(true);
  });

  it("asesores: las ven, pero no las crean ni las editan", async () => {
    stub(false);
    page();
    expect(await screen.findByText("/saludo")).toBeInTheDocument();
    expect(screen.getByText(/Solo los dueños y administradores las crean y editan/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Nueva respuesta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar /saludo" })).not.toBeInTheDocument();
  });
});
