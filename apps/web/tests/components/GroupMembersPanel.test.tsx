import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { GroupMembersPage, GroupMemberView } from "@contracts/GroupMemberContracts";
import { GroupMembersPanel } from "../../src/features/groups/members/GroupMembersPanel";
import { suggestedLabel } from "../../src/features/groups/members/LabelMembers";

// ---------------------------------------------------------------------------
// Los miembros de un grupo: el resumen (lo mismo que la tarjeta del grupo),
// los ocultos explicados, los filtros con su conteo, cada persona con lo que
// compró, ponerles una etiqueta por tandas hasta terminar y descargarlos. Lo
// que no puede hacer alguien (etiquetar, descargar) ni aparece.
// ---------------------------------------------------------------------------

const GROUP_ID = "aaaaaaaa-0000-4000-8000-000000000009";
const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

const person = (n: number, extra: Partial<GroupMemberView> = {}): GroupMemberView => ({
  key: `k${n}`, name: `Cliente ${n}`, phone: `5730000000${n}`, contactId: null, isAdmin: false, isOwnNumber: false, joinedAt: "2026-11-10T12:00:00.000Z", leftAt: null, bought: [], ...extra
});
const PAGE = (extra: Partial<GroupMembersPage> = {}): GroupMembersPage => ({
  group: { id: GROUP_ID, name: "Lanzamiento #3", position: 3, connectionName: "Ventas 1", members: 812, syncedAt: "2026-11-10T12:00:00.000Z" },
  counts: { all: 789, buyers: 37, nonBuyers: 740, left: 54, admins: 3 },
  hidden: 23,
  revenue: [{ currency: "COP", amount: 1850000 }],
  members: [person(1, { bought: [{ currency: "COP", amount: 49900 }] }), person(2, { name: null, isOwnNumber: true, isAdmin: true, joinedAt: null })],
  nextOffset: 100,
  canLabel: true,
  canExport: true,
  ...extra
});

let calls: Array<{ method: string; path: string; search: string; body: unknown }> = [];
function stub(page: GroupMembersPage = PAGE(), labelBatches: Array<{ labeled: number; remaining: number }> = []) {
  calls = [];
  const batches = [...labelBatches];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname, search: url.search, body });
    if (url.pathname === `/groups/list/${GROUP_ID}/members`) return reply(200, url.searchParams.get("offset") ? { ...page, members: [person(3)], nextOffset: null } : page);
    if (url.pathname === `/groups/list/${GROUP_ID}/members/label`) return reply(200, { label: body.label, ...batches.shift()! });
    if (url.pathname === `/groups/list/${GROUP_ID}/members/export`) {
      const headers = new Headers({ "Content-Disposition": 'attachment; filename="miembros_Lanzamiento_3_no_compraron.csv"', "X-Export-Rows": "740", "X-Export-Truncated": "false" });
      return { ok: true, status: 200, headers, blob: async () => new Blob(["x"]) } as unknown as Response;
    }
    return reply(404, {});
  }));
}
const open = () => render(<MemoryRouter><GroupMembersPanel groupId={GROUP_ID} groupName="Lanzamiento #3" onClose={vi.fn()} /></MemoryRouter>);
const panel = () => screen.getByRole("dialog", { name: "Lanzamiento #3" });

beforeEach(() => vi.restoreAllMocks());

describe("Miembros de un grupo", () => {
  it("el resumen dice cuántos están, compraron y salieron, y explica los que WhatsApp oculta", async () => {
    stub();
    open();
    const stats = await screen.findByText("En el grupo");
    expect(stats.closest("dl")).toHaveTextContent(/En el grupo812Compraron37\$\s?1\.850\.000.*Salieron54/);
    expect(within(panel()).getByText(/Se listan los 789 con número visible\. WhatsApp oculta el número de 23/)).toBeInTheDocument();
    expect(within(panel()).getByRole("tab", { name: "No compraron · 740" })).toBeInTheDocument();
  });

  it("cada persona: quién es, lo que compró o su chat; tu número marcado y sin chat", async () => {
    stub();
    open();
    const list = await screen.findByRole("list", { name: "Miembros" });
    const [first, second] = within(list).getAllByRole("listitem");
    expect(first).toHaveTextContent(/Cliente 1.*Compró \$\s?49\.900/);
    expect(second).toHaveTextContent(/Sin nombre.*Tu número.*Admin.*Ya estaba/);
    expect(within(second!).queryByRole("link")).not.toBeInTheDocument();
    await userEvent.click(within(panel()).getByRole("button", { name: /Ver más \(787\)/ }));
    expect(await within(list).findByText("Cliente 3")).toBeInTheDocument();
    expect(calls.at(-1)?.search).toContain("offset=100");
  });

  it("cambiar de filtro y buscar pide esa lista; con una búsqueda escrita no se etiqueta ni se descarga (son para todo el filtro)", async () => {
    stub();
    open();
    await userEvent.click(await screen.findByRole("tab", { name: "No compraron · 740" }));
    await waitFor(() => expect(calls.at(-1)?.search).toBe("?filter=nonBuyers"));
    await userEvent.type(within(panel()).getByRole("searchbox", { name: "Buscar miembros" }), "ana");
    await waitFor(() => expect(calls.at(-1)?.search).toBe("?filter=nonBuyers&search=ana"));
    expect(within(panel()).getByRole("button", { name: "Ponerles una etiqueta" })).toBeDisabled();
    expect(within(panel()).getByRole("button", { name: "Descargar" })).toBeDisabled();
  });

  it("ponerles una etiqueta: propone el nombre, va por tandas hasta terminar y lleva a Difusiones", async () => {
    stub(PAGE(), [{ labeled: 100, remaining: 640 }, { labeled: 100, remaining: 540 }, { labeled: 540, remaining: 0 }]);
    open();
    await userEvent.click(await screen.findByRole("tab", { name: "No compraron · 740" }));
    await userEvent.click(within(panel()).getByRole("button", { name: "Ponerles una etiqueta" }));
    expect(within(panel()).getByRole("textbox")).toHaveValue("Lanzamiento #3 – no compró");
    await userEvent.click(within(panel()).getByRole("button", { name: "Etiquetar" }));
    expect(await within(panel()).findByText("Listo: 740 personas con la etiqueta «Lanzamiento #3 – no compró».")).toBeInTheDocument();
    expect(calls.filter((call) => call.path.endsWith("/label")).map((call) => call.body)).toEqual(Array(3).fill({ filter: "nonBuyers", label: "Lanzamiento #3 – no compró" }));
    expect(within(panel()).getByRole("link", { name: "Difusiones" })).toHaveAttribute("href", "/broadcasts");
  });

  it("mientras trabaja la primera tanda ya se ve «Etiquetando…» (no parece que el botón no hizo nada)", async () => {
    stub();
    let finish: (value: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => (finish = resolve));
    const original = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn((input: string, init?: RequestInit) => (String(input).endsWith("/members/label") ? pending : original(input, init))));
    open();
    await userEvent.click(await screen.findByRole("tab", { name: "No compraron · 740" }));
    await userEvent.click(within(panel()).getByRole("button", { name: "Ponerles una etiqueta" }));
    await userEvent.click(within(panel()).getByRole("button", { name: "Etiquetar" }));
    expect(within(panel()).getByText("Etiquetando… 0 de 740")).toBeInTheDocument();
    finish(reply(200, { label: "x", labeled: 740, remaining: 0 }));
    expect(await within(panel()).findByText(/Listo: 740 personas/)).toBeInTheDocument();
  });

  it("la etiqueta propuesta nunca pasa de 40 caracteres", () => {
    expect(suggestedLabel("Un nombre de grupo larguísimo para la prueba #12", "nonBuyers")).toHaveLength(40);
    expect(suggestedLabel("VIP", "buyers")).toBe("VIP – compró");
  });

  it("descargar baja el CSV del filtro y dice cuántos trajo", async () => {
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
    stub();
    open();
    await userEvent.click(await screen.findByRole("tab", { name: "No compraron · 740" }));
    await userEvent.click(within(panel()).getByRole("button", { name: "Descargar" }));
    expect(await within(panel()).findByText("Listo: 740 personas.")).toBeInTheDocument();
    expect(calls.at(-1)).toMatchObject({ path: `/groups/list/${GROUP_ID}/members/export`, search: "?filter=nonBuyers" });
    // Al cambiar de filtro, el aviso de la descarga anterior no se queda (sería de otro filtro).
    await userEvent.click(within(panel()).getByRole("tab", { name: "Compraron · 37" }));
    expect(within(panel()).queryByText("Listo: 740 personas.")).not.toBeInTheDocument();
  });

  it("quien no puede etiquetar ni descargar no ve esos botones; sin permiso de ventas no hay plata", async () => {
    stub(PAGE({ canLabel: false, canExport: false, revenue: null, members: [person(1, { bought: null })] }));
    open();
    await screen.findByRole("list", { name: "Miembros" });
    expect(within(panel()).queryByRole("button", { name: "Ponerles una etiqueta" })).not.toBeInTheDocument();
    expect(within(panel()).queryByRole("button", { name: "Descargar" })).not.toBeInTheDocument();
    expect(within(panel()).queryByRole("button", { name: /Traer de WhatsApp/ })).not.toBeInTheDocument();
    expect(panel()).not.toHaveTextContent("Compró");
  });
});
