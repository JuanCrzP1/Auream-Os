import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { LabelOverview, LabelsOverviewResponse } from "@contracts/LabelManagementContracts";
import { LabelsSettings } from "../../src/features/labels/LabelsSettings";

// ---------------------------------------------------------------------------
// Configuración › Etiquetas: cuántos clientes tiene cada una, cuánto vendieron
// y quién la usa; las repetidas con «Unir»; borrar una que trabaja pide a
// cuál pasar sus clientes y sus usos; renombrar avisa que cambia en los
// flujos; una etapa del CRM no se une en otra; y el Asesor solo cambia colores.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;
const stage = { kind: "stage" as const, pipelineId: "p1", pipelineName: "Ventas" };
const flowUse = { kind: "flow" as const, flowKey: "bienvenida", flowName: "Bienvenida", blockId: "b1", blockName: "Marca pago", how: "adds" as const };

const PAGADO: LabelOverview = { id: "l1", name: "Pagado", color: "#10b981", contactCount: 3011, uses: [stage], sales: [{ currency: "COP", amount: 9_800_000, sales: 40 }] };
const REPETIDA: LabelOverview = { id: "l2", name: "‎Pagado", color: "#64748b", contactCount: 2454, uses: [flowUse, { kind: "broadcast", id: "b1", name: "Black Friday" }], sales: [] };
const VIEJA: LabelOverview = { id: "l3", name: "No contactar", color: "#64748b", contactCount: 0, uses: [], sales: [] };

function stub(over: Partial<LabelsOverviewResponse> = {}) {
  const data: LabelsOverviewResponse = {
    labels: [PAGADO, REPETIDA, VIEJA],
    duplicates: [{ name: "Pagado", keepId: "l1", otherIds: ["l2"] }],
    merges: [],
    canManage: true,
    canEdit: true,
    canSeeSales: true,
    ...over
  };
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    if (url.pathname === "/labels/overview") return reply(200, data);
    if (url.pathname === "/labels/merge") return reply(202, { merge: { id: "m1" }, flowsSkipped: ["Ventas VE"] });
    if (url.pathname === "/labels" && method === "POST") return reply(201, { id: "l9", name: "VIP", color: "#ef4444" });
    if (url.pathname.startsWith("/labels/") && method === "PATCH") return reply(200, { id: "l1", name: "Pagó", color: "#10b981", flowsSkipped: [] });
    if (url.pathname.startsWith("/labels/") && method === "DELETE") return reply(200, { deleted: true });
    return reply(404, {});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const page = () => render(<MemoryRouter><LabelsSettings /></MemoryRouter>);
const call = (fetchMock: ReturnType<typeof stub>, method: string, path: string) => {
  const found = fetchMock.mock.calls.find(([url, init]) => String(url).includes(path) && (init?.method ?? "GET") === method);
  return found ? { url: String(found[0]), body: found[1]?.body ? JSON.parse(String(found[1].body)) : null } : null;
};

beforeEach(() => vi.restoreAllMocks());

describe("Etiquetas", () => {
  it("clientes, lo que vendieron y quién la usa; la que nadie usa se puede borrar", async () => {
    stub();
    page();
    const table = await screen.findByRole("region", { name: "Tus etiquetas" });
    expect(within(table).getByRole("button", { name: "Pagado · 3011 clientes" })).toHaveTextContent("3.011$ 9,8 M COPEtapa · Ventas");
    expect(within(table).getByRole("button", { name: /Pagado · 2454 clientes/ })).toHaveTextContent("1 flujo · 1 difusión");
    expect(within(table).getByRole("button", { name: /No contactar/ })).toHaveTextContent("Nadie la usa · se puede borrar");
    expect(screen.getByRole("link", { name: "ver el embudo en el CRM" })).toHaveAttribute("href", "/crm");
  });

  it("las repetidas: dice cuántos tiene cada una y «Unir» pasa todo a la etapa", async () => {
    const fetchMock = stub();
    page();
    const card = await screen.findByRole("region", { name: "Etiquetas repetidas" });
    expect(card).toHaveTextContent("«Pagado» está dos veces");
    expect(card).toHaveTextContent("3.011 clientes + 2.454 clientes");
    await userEvent.click(within(card).getByRole("button", { name: "Unir en «Pagado»" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("combobox")).toHaveValue("l1");
    expect(dialog).toHaveTextContent("Sus clientes entran a la etapa «Pagado» del embudo");
    expect(dialog).toHaveTextContent("Marca pago");
    await userEvent.click(within(dialog).getByRole("button", { name: "Unir" }));
    expect(call(fetchMock, "POST", "/labels/merge")!.body).toEqual({ from: "l2", into: "l1" });
    expect(await screen.findByRole("alert")).toHaveTextContent("El flujo «Ventas VE» no se pudo actualizar");
  });

  it("borrar una que trabaja pide a cuál pasarla; una que nadie usa se borra con un clic", async () => {
    const fetchMock = stub();
    page();
    await userEvent.click(await screen.findByRole("button", { name: /Pagado · 2454 clientes/ }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Borrar" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("está trabajando");
    const confirm = within(dialog).getByRole("button", { name: "Pasar y borrar" });
    expect(confirm).toBeDisabled();
    await userEvent.selectOptions(within(dialog).getByRole("combobox"), "l1");
    await userEvent.click(confirm);
    expect(call(fetchMock, "POST", "/labels/merge")!.body).toEqual({ from: "l2", into: "l1" });

    await userEvent.click(await screen.findByRole("button", { name: /No contactar/ }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Borrar" }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Borrar etiqueta" }));
    expect(call(fetchMock, "DELETE", "/labels/l3")!.url).not.toContain("into=");
  });

  it("una etapa no se une en otra; renombrarla avisa que cambia en los flujos", async () => {
    const fetchMock = stub({ labels: [{ ...PAGADO, uses: [stage, flowUse] }, REPETIDA, VIEJA] });
    page();
    await userEvent.click(await screen.findByRole("button", { name: "Pagado · 3011 clientes" }));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByRole("button", { name: "Unir con otra" })).toBeDisabled();
    const name = within(drawer).getByLabelText("Nombre");
    await userEvent.clear(name);
    await userEvent.type(name, "Pagó");
    expect(drawer).toHaveTextContent("También cambia en 1 flujo.");
    await userEvent.click(within(drawer).getByRole("button", { name: "Guardar cambios" }));
    expect(call(fetchMock, "PATCH", "/labels/l1")!.body).toEqual({ name: "Pagó" });
  });

  it("el Asesor cambia el color, no el nombre; no ve unir ni borrar", async () => {
    const fetchMock = stub({ canManage: false, duplicates: [{ name: "Pagado", keepId: "l1", otherIds: ["l2"] }] });
    page();
    expect(within(await screen.findByRole("region", { name: "Etiquetas repetidas" })).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /No contactar/ }));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByLabelText("Nombre")).toBeDisabled();
    expect(within(drawer).queryByRole("button", { name: "Borrar" })).toBeNull();
    await userEvent.click(within(drawer).getByRole("radio", { name: "Rojo" }));
    await userEvent.click(within(drawer).getByRole("button", { name: "Guardar cambios" }));
    expect(call(fetchMock, "PATCH", "/labels/l3")!.body).toEqual({ color: "#ef4444" });
  });

  it("una unión en curso muestra su avance; sin ventas no se ve esa columna", async () => {
    stub({ canSeeSales: false, merges: [{ id: "m1", fromName: "‎Pagado", intoId: "l1", intoName: "Pagado", total: 2454, moved: 1200, status: "running", error: null, createdAt: "" }] });
    page();
    expect(await screen.findByRole("status")).toHaveTextContent("Pasaron 1.200 de 2.454 clientes. Sus flujos, difusiones y webhooks ya usan «Pagado».");
    expect(screen.queryByText("Vendieron · 30 d")).toBeNull();
  });
});
