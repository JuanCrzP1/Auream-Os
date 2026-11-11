import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ArticleDetail, HelpHomeResponse } from "@contracts/HelpContracts";
import { HelpPage } from "../../src/features/help/pages/HelpPage";
import { HelpPanel } from "../../src/shared/help/HelpPanel";

// ---------------------------------------------------------------------------
// Ayuda: la portada (buscar, empezar, módulos, soporte), un artículo con su
// Markdown (pasos, avisos, índice) y «¿Te sirvió?», abrir un caso de soporte,
// el panel «?» de cada pantalla y «Administrar» solo para el equipo de Auream.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;
const SUMMARY = { slug: "conectar-whatsapp-qr", title: "Conectar tu WhatsApp con el código QR", module: "conexiones" as const, summary: "Vincula tu número", minutes: 2, updated: "2026-11-11" };
const HOME = (canManage: boolean): HelpHomeResponse => ({
  modules: [{ id: "conexiones", name: "Conexiones", description: "Conectar WhatsApp", articles: 5 }],
  popular: [SUMMARY], news: [{ ...SUMMARY, slug: "novedades-grupos", title: "Nuevo: Grupos y comunidades" }],
  onboarding: [{ id: "number", title: "Conecta tu número de WhatsApp", detail: "Con el QR", done: true, path: "/connections" }, { id: "flow", title: "Crea tu primer flujo", detail: "Bienvenida", done: false, path: "/automations" }],
  tutorials: [], support: { whatsapp: "573001234567", email: "soporte@auream.co", hours: "L a V", responseTime: "2 horas" }, canManage
});
const ARTICLE: ArticleDetail = { ...SUMMARY, body: "Intro.\n\n## Pasos\n\n1. Entra a **Conexiones**.\n2. Escanea.\n\n> **Importante:** no cierres la sesión.\n\nLee [qué hacer si se desconecta](numero-desconectado).", sections: [{ id: "pasos", title: "Pasos" }], related: [], tutorial: null };

let calls: Array<{ method: string; path: string; body: unknown }> = [];
function stub(canManage = false) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    calls.push({ method, path: url.pathname + url.search, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.pathname === "/help") return reply(200, HOME(canManage));
    if (url.pathname === "/help/search") return reply(200, { results: [SUMMARY] });
    if (url.pathname === "/help/articles/conectar-whatsapp-qr") return reply(200, ARTICLE);
    if (url.pathname.endsWith("/feedback")) return reply(204);
    if (url.pathname === "/help/support") return reply(200, { settings: HOME(false).support, cases: [] });
    if (url.pathname === "/help/support/cases") return reply(201, { cases: [{ id: "c1", topic: "Flujos", message: "No responde", page: "/broadcasts", screenshotUrl: null, articleSlug: null, status: "open", reply: null, createdAt: new Date().toISOString(), answeredAt: null }] });
    if (url.pathname === "/help/modules/difusiones") return reply(200, { articles: [{ ...SUMMARY, slug: "primera-difusion", title: "Enviar tu primera difusión", module: "difusiones" }] });
    if (url.pathname === "/help/tutorials") return reply(200, { tutorials: [] });
    return reply(404, {});
  }));
}
const page = (path = "/help") => render(<MemoryRouter initialEntries={[path]}><HelpPage /><HelpPanel /></MemoryRouter>);

beforeEach(() => vi.restoreAllMocks());

describe("Ayuda", () => {
  it("la portada: buscar, empezar aquí, módulos y soporte (sin administrar para una cuenta)", async () => {
    stub();
    page();
    expect(await screen.findByRole("region", { name: "Empieza aquí" })).toHaveTextContent("1 de 2 listos");
    expect(screen.getByRole("button", { name: /Conexiones/ })).toHaveTextContent("5 artículos");
    const support = screen.getByRole("region", { name: "Contactar a soporte" });
    expect(within(support).getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", expect.stringContaining("https://wa.me/573001234567"));
    expect(support).toHaveTextContent("Respondemos en 2 horas");
    expect(screen.queryByRole("button", { name: /Administrar ayuda/ })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar en la ayuda" }), "qr");
    expect(await screen.findByRole("option", { name: /Conectar tu WhatsApp/ })).toBeInTheDocument();
  });

  it("el equipo de Auream ve «Administrar ayuda»", async () => {
    stub(true);
    page();
    expect(await screen.findByRole("button", { name: /Administrar ayuda/ })).toBeInTheDocument();
  });

  it("un artículo: pasos, aviso, índice, enlace a otro artículo y «¿Te sirvió?»", async () => {
    stub();
    page("/help?article=conectar-whatsapp-qr");
    expect(await screen.findByRole("heading", { level: 1, name: SUMMARY.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Pasos" })).toHaveAttribute("id", "pasos");
    expect(screen.getByText("Conexiones", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText(/no cierres la sesión/).closest("aside")).toHaveClass("help-callout--warn");
    expect(screen.getByRole("link", { name: "qué hacer si se desconecta" })).toHaveAttribute("href", "/help?article=numero-desconectado");
    expect(within(screen.getByRole("navigation", { name: "En este artículo" })).getByRole("link", { name: "Pasos" })).toHaveAttribute("href", "#pasos");
    await userEvent.click(screen.getByRole("button", { name: "👍 Sí" }));
    await waitFor(() => expect(calls.some((c) => c.path.endsWith("/feedback") && (c.body as { helpful: boolean }).helpful)).toBe(true));
  });

  it("abrir un caso de soporte con la pantalla desde donde escribe", async () => {
    stub();
    page("/help?view=support");
    await userEvent.click(await screen.findByRole("button", { name: "Flujos" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Cuéntanos qué pasa" }), "No responde");
    await userEvent.click(screen.getByRole("button", { name: "Enviar a soporte" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/help/support/cases")?.body).toMatchObject({ topic: "Flujos", message: "No responde", page: "/help" }));
    expect(await screen.findByRole("region", { name: "Tus casos" })).toHaveTextContent("Abierto");
  });

  it("el panel «?» muestra la ayuda de la pantalla en que estás", async () => {
    stub();
    render(<MemoryRouter initialEntries={["/broadcasts"]}><HelpPanel /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: "Ayuda y soporte" }));
    expect(await screen.findByRole("link", { name: /Enviar tu primera difusión/ })).toHaveAttribute("href", "/help?article=primera-difusion");
    expect(screen.getByText(/Para esta pantalla · Difusiones/)).toBeInTheDocument();
  });
});
