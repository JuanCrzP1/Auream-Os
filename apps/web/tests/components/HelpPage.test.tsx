import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ArticleDetail, HelpHomeResponse } from "@contracts/HelpContracts";
import { HelpPage } from "../../src/features/help/pages/HelpPage";
import { HelpPanel } from "../../src/shared/help/HelpPanel";

// ---------------------------------------------------------------------------
// Ayuda: la portada (buscar, empezar, módulos, soporte), un artículo con su
// Markdown (pasos, avisos, índice), «Más del módulo», anterior/siguiente y
// «¿Te sirvió?», el panel «?» de cada pantalla (solo ayuda, con buscador) y
// «Administrar» solo para el equipo de Auream.
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
    if (url.pathname === "/help/modules/conexiones") return reply(200, { articles: [SUMMARY, { ...SUMMARY, slug: "numero-desconectado", title: "Qué hacer si tu número se desconecta" }] });
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
    expect(within(screen.getByRole("navigation", { name: "Ruta" })).getByText(SUMMARY.title)).toHaveAttribute("aria-current", "page");
    expect(screen.getByText(/no cierres la sesión/).closest("aside")).toHaveClass("help-callout--warn");
    expect(screen.getByRole("link", { name: "qué hacer si se desconecta" })).toHaveAttribute("href", "/help?article=numero-desconectado");
    expect(within(screen.getByRole("navigation", { name: "En este artículo" })).getByRole("link", { name: "Pasos" })).toHaveAttribute("href", "#pasos");
    expect(await screen.findByRole("navigation", { name: "Seguir leyendo" })).toHaveTextContent("Qué hacer si tu número se desconecta");
    expect(within(screen.getByRole("region", { name: "Más de Conexiones" })).getByText(SUMMARY.title)).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("region", { name: "Contactar a soporte" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sí" }));
    await waitFor(() => expect(calls.some((c) => c.path.endsWith("/feedback") && (c.body as { helpful: boolean }).helpful)).toBe(true));
  });

  it("el panel «?»: solo ayuda, lo de la pantalla en que estás y un buscador", async () => {
    stub();
    render(<MemoryRouter initialEntries={["/broadcasts"]}><HelpPanel /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: "Ayuda" }));
    expect(await screen.findByRole("link", { name: /Enviar tu primera difusión/ })).toHaveAttribute("href", "/help?article=primera-difusion");
    expect(screen.getByText(/Para esta pantalla · Difusiones/)).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText(/soporte/i)).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar en la ayuda" }), "qr");
    expect(await screen.findByRole("link", { name: /Conectar tu WhatsApp/ })).toHaveAttribute("href", "/help?article=conectar-whatsapp-qr");
    expect(screen.getByText("1 resultado")).toBeInTheDocument();
  });
});
