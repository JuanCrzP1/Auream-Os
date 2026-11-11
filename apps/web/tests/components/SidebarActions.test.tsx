import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { NotificationFeed } from "@contracts/NotificationContracts";
import { NotificationBell } from "../../src/shared/account/NotificationBell";
import { SupportButton } from "../../src/shared/account/SupportButton";
import { HelpPanel } from "../../src/shared/help/HelpPanel";

// ---------------------------------------------------------------------------
// Junto a la cuenta: la campana (número de lo nuevo, cada aviso lleva a donde
// se resuelve, al abrirla queda vista) y la diadema de soporte (WhatsApp y
// correo si el equipo los configuró; si no, el Centro de ayuda).
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;
const FEED: NotificationFeed = {
  unread: 1,
  items: [
    { id: "number:c1", kind: "number_disconnected", title: "Ventas 1 se desconectó", detail: "Vuelve a escanear el código QR.", path: "/connections", occurredAt: new Date().toISOString(), unread: true },
    { id: "sales:review", kind: "sales_review", title: "2 ventas esperan revisión", detail: "Complétalas.", path: "/sales?tab=review", occurredAt: new Date(Date.now() - 86_400_000).toISOString(), unread: false }
  ]
};

function stub(support: Record<string, string | null>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    calls.push(`${init?.method ?? "GET"} ${url.pathname}`);
    if (url.pathname === "/notifications") return reply(200, FEED);
    if (url.pathname === "/notifications/seen") return reply(204);
    if (url.pathname === "/help/support") return reply(200, { settings: support, cases: [] });
    if (url.pathname.startsWith("/help/modules/")) return reply(200, { articles: [] });
    if (url.pathname === "/help/tutorials") return reply(200, { tutorials: [] });
    return reply(404, {});
  }));
  return calls;
}

describe("Campana y soporte junto a la cuenta", () => {
  it("la campana: cuántos avisos nuevos, la lista y al abrirla quedan vistos", async () => {
    const calls = stub({ whatsapp: null, email: null, hours: null, responseTime: null });
    render(<MemoryRouter><NotificationBell /></MemoryRouter>);
    const bell = await screen.findByRole("button", { name: "Notificaciones, 1 nuevas" });
    expect(bell).toHaveTextContent("1");
    await userEvent.click(bell);
    const panel = await screen.findByRole("dialog", { name: "Notificaciones" });
    expect(within(panel).getByRole("link", { name: /Ventas 1 se desconectó/ })).toHaveAttribute("href", "/connections");
    expect(within(panel).getByRole("link", { name: /2 ventas esperan revisión/ })).toHaveAttribute("href", "/sales?tab=review");
    expect(within(panel).getAllByText("Nuevo")).toHaveLength(1);
    await waitFor(() => expect(calls).toContain("POST /notifications/seen"));
    expect(screen.getByRole("button", { name: "Notificaciones" })).not.toHaveTextContent("1");
  });

  it("soporte: WhatsApp y correo cuando el equipo los configuró", async () => {
    stub({ whatsapp: "573001234567", email: "soporte@auream.co", hours: "L a V", responseTime: "2 horas" });
    render(<MemoryRouter initialEntries={["/crm"]}><SupportButton /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: "Soporte" }));
    const card = await screen.findByRole("dialog", { name: "Soporte" });
    expect(await within(card).findByRole("link", { name: /Escribir por WhatsApp/ })).toHaveAttribute("href", expect.stringContaining("https://wa.me/573001234567"));
    expect(within(card).getByRole("link", { name: /Correo/ })).toHaveAttribute("href", "mailto:soporte@auream.co");
    expect(card).toHaveTextContent("Respondemos en 2 horas · L a V");
  });

  it("soporte sin configurar: lo dice y deja el Centro de ayuda", async () => {
    stub({ whatsapp: null, email: null, hours: null, responseTime: null });
    render(<MemoryRouter><SupportButton /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: "Soporte" }));
    const card = await screen.findByRole("dialog", { name: "Soporte" });
    expect(await within(card).findByText(/Estamos configurando los canales de soporte/)).toBeInTheDocument();
    expect(within(card).queryByRole("link", { name: /WhatsApp/ })).not.toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /Centro de ayuda/ })).toHaveAttribute("href", "/help");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Soporte" })).not.toBeInTheDocument());
  });

  it("soporte abre la ayuda de la pantalla donde estás (sin botón flotante que la tape)", async () => {
    stub({ whatsapp: null, email: null, hours: null, responseTime: null });
    render(<MemoryRouter initialEntries={["/conversations"]}><SupportButton /><HelpPanel /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "Ayuda" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Soporte" }));
    await userEvent.click(await screen.findByRole("button", { name: /Ayuda de esta pantalla/ }));
    expect(await screen.findByRole("complementary", { name: "Ayuda" })).toHaveTextContent(/Estás en Conversaciones/);
    expect(screen.queryByRole("dialog", { name: "Soporte" })).not.toBeInTheDocument();
  });
});
