import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { BusinessDataResponse, BusinessDatumSummary } from "@contracts/BusinessDataContracts";
import type { BusinessDataChange, BusinessDataSchedule } from "@contracts/BusinessDataTimeline";
import { BusinessDataSettings } from "../../src/features/business-data/BusinessDataSettings";
import { historyLine } from "../../src/features/business-data/history/historyText";
import { broadcastsDuring, rowBadge, shortRange, spanLabel } from "../../src/features/business-data/schedules/scheduleText";

// ---------------------------------------------------------------------------
// Datos del negocio en el tiempo: la lista muestra el valor que reciben los
// clientes AHORA (con su etiqueta), los cambios programados se programan,
// quitan o terminan desde el detalle, y el historial dice quién cambió qué,
// con «Volver a este valor». Todo en la hora de la empresa.
// ---------------------------------------------------------------------------

const TZ = "America/Bogota";
const HOUR = 3_600_000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const schedule = (over: Partial<BusinessDataSchedule>): BusinessDataSchedule => ({ id: "s1", value: "Cerrado", startsAt: at(40 * 24 * HOUR), endsAt: at(42 * 24 * HOUR), note: "Navidad", createdBy: "Camilo", createdAt: at(0), ...over });

const HORARIO: BusinessDatumSummary = {
  id: "d1", key: "g_horario", label: "Horario", type: "text", value: "8 a 6", description: "", createdAt: "", updatedAt: "u1",
  schedules: [schedule({}), schedule({ id: "s2", note: "Año Nuevo", startsAt: at(47 * 24 * HOUR), endsAt: at(48 * 24 * HOUR) })],
  uses: [{ kind: "broadcast", id: "b1", name: "Feliz Navidad", sendAt: at(40 * 24 * HOUR + HOUR) }],
  example: { template: "Atendemos {g_horario}", source: "Flujo «Ventas» · Horario" }
};
const LINK: BusinessDatumSummary = {
  id: "d2", key: "g_link_de_pago", label: "Link de pago", type: "text", value: "https://tutienda.com/pagar", description: "", createdAt: "", updatedAt: "u1",
  schedules: [schedule({ id: "s3", value: "https://tutienda.com/promo", note: "Promo", startsAt: at(-HOUR), endsAt: at(2 * 24 * HOUR) })],
  uses: [], example: null
};
const HISTORY: BusinessDataChange[] = [
  { id: "c2", kind: "value", before: "8 a 6", after: "9 a 7", at: at(-2 * HOUR), actorName: "Laura", valueType: "text" },
  { id: "c1", kind: "created", value: "8 a 6", at: at(-48 * HOUR), actorName: "Camilo", valueType: "text" }
];

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

function stub(data: BusinessDataResponse) {
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    if (url.pathname === "/business-data" && method === "GET") return reply(200, data);
    if (url.pathname.endsWith("/history")) return reply(200, { changes: HISTORY });
    if (url.pathname.includes("/schedules")) return reply(method === "POST" ? 201 : 200, data.data[0]);
    if (method === "PATCH") return reply(200, data.data[0]);
    return reply(404, {});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const page = () => render(<MemoryRouter><BusinessDataSettings /></MemoryRouter>);
const call = (fetchMock: ReturnType<typeof stub>, method: string, path: string) => {
  const found = fetchMock.mock.calls.find(([url, init]) => init?.method === method && String(url).includes(path))!;
  return { url: String(found[0]), body: found[1]?.body ? JSON.parse(String(found[1].body)) : null };
};

beforeEach(() => {
  vi.restoreAllMocks();
  window.localStorage.setItem("auream.how-it-works.business-data", "closed");
});

describe("en la lista", () => {
  it("el valor de ahora: el programado mientras rige (con el de siempre debajo) y la etiqueta del próximo", async () => {
    stub({ data: [HORARIO, LINK], canManage: true, timeZone: TZ });
    page();
    const link = await screen.findByRole("button", { name: /Link de pago/ });
    expect(link).toHaveTextContent("https://tutienda.com/promo");
    expect(link).toHaveTextContent(/Ahora: Promo · hasta el \d+ \w+/);
    expect(link).toHaveTextContent("Siempre: https://tutienda.com/pagar");
    expect(screen.getByRole("button", { name: /Horario/ })).toHaveTextContent(/Navidad · .+ · \+1 más/);
  });
});

describe("en el detalle", () => {
  it("programar un cambio: valor, desde y hasta en la hora de la empresa y una nota", async () => {
    const fetchMock = stub({ data: [{ ...HORARIO, schedules: [], uses: [] }], canManage: true, timeZone: TZ });
    page();
    await userEvent.click(await screen.findByRole("button", { name: /Horario/ }));
    await userEvent.click(screen.getByRole("tab", { name: /Cambios programados/ }));
    expect(screen.getByText("Ningún cambio programado")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "+ Programar un cambio" }));
    const form = screen.getByRole("form", { name: "Programar un cambio" });
    await userEvent.type(within(form).getByLabelText("Valor mientras dura"), "Hoy cerramos");
    await userEvent.clear(within(form).getByLabelText("Fecha desde"));
    await userEvent.type(within(form).getByLabelText("Fecha desde"), "2030-12-24");
    await userEvent.clear(within(form).getByLabelText("Fecha hasta"));
    await userEvent.type(within(form).getByLabelText("Fecha hasta"), "2030-12-26");
    await userEvent.type(within(form).getByLabelText(/Nota/), "Navidad");
    expect(form).toHaveTextContent("Dura 2 días");
    await userEvent.click(within(form).getByRole("button", { name: "Programar" }));
    expect(call(fetchMock, "POST", "/schedules").body).toEqual({ value: "Hoy cerramos", from: { date: "2030-12-24", time: "00:00" }, until: { date: "2030-12-26", time: "00:00" }, note: "Navidad" });
  });

  it("cada cambio con su estado; avisa de la difusión que sale con él; quitar se confirma", async () => {
    const fetchMock = stub({ data: [HORARIO], canManage: true, timeZone: TZ });
    page();
    await userEvent.click(await screen.findByRole("button", { name: /Horario/ }));
    await userEvent.click(screen.getByRole("tab", { name: /Cambios programados/ }));
    const navidad = screen.getByRole("article", { name: /Navidad · Empieza en 40 días/ });
    expect(navidad).toHaveTextContent("La difusión «Feliz Navidad» sale el");
    await userEvent.click(within(navidad).getByRole("button", { name: "Quitar" }));
    expect(navidad).toHaveTextContent("¿Quitar «Navidad»?");
    await userEvent.click(within(navidad).getByRole("button", { name: "Sí, quitar" }));
    expect(call(fetchMock, "DELETE", "/schedules/s1").url).toContain("/business-data/d1/schedules/s1");
  });

  it("uno que rige se termina ya, y «Así lo ve tu cliente» se ve ahora o siempre", async () => {
    stub({ data: [LINK], canManage: true, timeZone: TZ });
    page();
    await userEvent.click(await screen.findByRole("button", { name: /Link de pago/ }));
    const preview = screen.getByRole("figure", { name: "Así lo ve tu cliente" });
    expect(preview).toHaveTextContent("https://tutienda.com/promo");
    await userEvent.click(screen.getByRole("radio", { name: "Siempre" }));
    expect(preview).toHaveTextContent("https://tutienda.com/pagar");
    expect(screen.getByText("Valor de siempre")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /Cambios programados/ }));
    const promo = screen.getByRole("article", { name: /Promo · Activo ahora/ });
    await userEvent.click(within(promo).getByRole("button", { name: "Terminar ya" }));
    expect(promo).toHaveTextContent("¿Terminar ya? Vuelve «https://tutienda.com/pagar».");
  });

  it("el historial: quién cambió qué; «Volver a este valor» una sola vez y lo guarda como un cambio más", async () => {
    const fetchMock = stub({ data: [{ ...HORARIO, value: "9 a 7" }], canManage: true, timeZone: TZ });
    page();
    await userEvent.click(await screen.findByRole("button", { name: /Horario/ }));
    await userEvent.click(screen.getByRole("tab", { name: "Historial" }));
    const history = await screen.findByRole("list", { name: "Historial" });
    expect(history).toHaveTextContent("Laura cambió el valor de «8 a 6» a «9 a 7»");
    expect(history).toHaveTextContent("Camilo lo creó con «8 a 6»");
    const restore = within(history).getAllByRole("button", { name: "Volver a «8 a 6»" });
    expect(restore).toHaveLength(1);
    await userEvent.click(restore[0]!);
    expect(call(fetchMock, "PATCH", "/business-data/d1").body).toEqual({ value: "8 a 6" });
  });
});

describe("los textos", () => {
  it("lapsos redondeados, la etiqueta de la lista y las difusiones durante un cambio", () => {
    expect([spanLabel(59.6 * 60_000), spanLabel(23.6 * HOUR), spanLabel(42 * HOUR), spanLabel(40.3 * 24 * HOUR)]).toEqual(["1 h", "1 día", "1 día y 18 h", "40 días"]);
    const navidad = schedule({ startsAt: "2026-12-24T13:00:00.000Z", endsAt: "2026-12-26T13:00:00.000Z" });
    expect(shortRange(navidad, TZ)).toBe("24 → 26 dic");
    expect(shortRange({ startsAt: "2026-12-31T19:00:00.000Z", endsAt: "2027-01-02T13:00:00.000Z" }, TZ)).toBe("31 dic → 2 ene");
    expect(rowBadge([navidad], TZ, new Date("2026-12-25T00:00:00.000Z"))).toEqual({ tone: "now", text: "Ahora: Navidad · hasta el 26 dic" });
    expect(broadcastsDuring(HORARIO.uses, { startsAt: at(39 * 24 * HOUR), endsAt: at(41 * 24 * HOUR) })).toHaveLength(1);
    expect(historyLine({ id: "x", kind: "value", before: "true", after: "false", at: "", actorName: null, valueType: "boolean" }).pieces.map((piece) => piece.text).join("")).toBe(" cambió el valor de «Sí» a «No»");
  });
});
