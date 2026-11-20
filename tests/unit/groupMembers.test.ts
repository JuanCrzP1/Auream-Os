import { describe, expect, it, vi } from "vitest";
import { GroupMemberServices, type GroupMemberActor } from "../../domains/groups/application/GroupMemberServices.js";
import type { GroupMemberReader, MemberQuery, MemberRow } from "../../domains/groups/application/GroupMemberPorts.js";
import type { WaGroup } from "../../domains/groups/application/GroupPorts.js";
import { GROUP_LABEL_BATCH, GROUP_MEMBERS_PAGE } from "../../contracts/GroupMemberContracts.js";

// ---------------------------------------------------------------------------
// Los miembros de un grupo, el servicio: la plata solo a quien ve ventas (y
// la misma que la tarjeta del grupo), páginas, filtros válidos, la etiqueta
// por tandas sin repetir y la descarga como tabla (en la hora de la empresa).
// ---------------------------------------------------------------------------

const T = "tenant-a";
const GROUP = "11111111-1111-4111-8111-111111111111";
const OWNER: GroupMemberActor = { tenantId: T, canSeeSales: true, canLabel: true, canExport: true };
const VIEWER_NO_SALES: GroupMemberActor = { tenantId: T, canSeeSales: false, canLabel: false, canExport: false };

const group: WaGroup = {
  id: GROUP, tenantId: T, connectionId: "c1", jid: "1203@g.us", name: "Lanzamiento #3", description: "", imageUrl: null, members: 812, isAdmin: true,
  announce: true, locked: true, inviteLink: null, campaignId: "camp", position: 3, syncedAt: "2026-11-10T12:00:00.000Z", lastWelcomeAt: null, createdAt: "2026-11-01T00:00:00.000Z"
};

const member = (n: number, extra: Partial<MemberRow> = {}): MemberRow => ({
  key: `m${n}`, name: `Cliente ${n}`, phone: `57300000${String(n).padStart(4, "0")}`, contactId: null, isAdmin: false, isOwnNumber: false,
  joinedAt: "2026-11-05T15:30:00.000Z", leftAt: null, bought: [], ...extra
});

function setup(rows: MemberRow[] = [member(1, { bought: [{ currency: "COP", amount: 49900 }] }), member(2, { joinedAt: null })], pending: string[] = []) {
  const queries: MemberQuery[] = [];
  let queue = [...pending];
  const reader: GroupMemberReader = {
    page: async (_t, _g, query) => {
      queries.push(query);
      return { rows: rows.slice(query.offset, query.offset + query.limit), counts: { all: rows.length, buyers: 1, nonBuyers: 1, left: 0, admins: 0 }, hidden: 23 };
    },
    toLabel: async (_t, _g, _f, _label, limit) => ({ phones: queue.slice(0, limit), total: queue.length })
  };
  const tag = vi.fn(async (_t: string, phone: string) => void (queue = queue.filter((p) => p !== phone)));
  const services = new GroupMemberServices(
    {
      groups: { find: async (tenantId: string, id: string) => (tenantId === T && id === GROUP ? group : null) } as never,
      results: { groups: async () => new Map([[GROUP, { members: 812, joined: 40, left: 5, buyers: 1, revenue: [{ currency: "COP", amount: 49900 }] }]]) } as never,
      numbers: { list: async () => [{ id: "c1", name: "Ventas", connected: true, qr: true }] },
      labeler: { tag },
      timezoneOf: async () => "America/Bogota"
    },
    reader
  );
  return { services, queries, tag };
}

describe("ver los miembros", () => {
  it("trae el grupo, los conteos, los ocultos y lo vendido de la MISMA cuenta que la tarjeta del grupo", async () => {
    const { services } = setup();
    const page = await services.page(OWNER, GROUP, {});
    expect(page.group).toEqual({ id: GROUP, name: "Lanzamiento #3", position: 3, connectionName: "Ventas", members: 812, syncedAt: "2026-11-10T12:00:00.000Z" });
    expect(page).toMatchObject({ hidden: 23, revenue: [{ currency: "COP", amount: 49900 }], counts: { all: 2, buyers: 1 }, nextOffset: null, canLabel: true, canExport: true });
    expect(page.members[0]!.bought).toEqual([{ currency: "COP", amount: 49900 }]);
  });

  it("sin permiso de ventas no ve plata: ni lo de cada uno ni el total", async () => {
    const { services } = setup();
    const page = await services.page(VIEWER_NO_SALES, GROUP, {});
    expect(page.revenue).toBeNull();
    expect(page.members.map((m) => m.bought)).toEqual([null, null]);
    expect(page).toMatchObject({ canLabel: false, canExport: false });
  });

  it("pagina de a 100 y dice desde dónde seguir; la búsqueda se recorta y vacía no cuenta", async () => {
    const rows = Array.from({ length: GROUP_MEMBERS_PAGE + 5 }, (_, i) => member(i));
    const { services, queries } = setup(rows);
    const first = await services.page(OWNER, GROUP, { filter: "all", search: "   " });
    expect([first.members.length, first.nextOffset]).toEqual([GROUP_MEMBERS_PAGE, GROUP_MEMBERS_PAGE]);
    const second = await services.page(OWNER, GROUP, { offset: String(first.nextOffset), search: ` ${"a".repeat(80)} ` });
    expect([second.members.length, second.nextOffset]).toEqual([5, null]);
    expect(queries.map((q) => [q.filter, q.search?.length ?? null, q.offset, q.limit])).toEqual([["all", null, 0, GROUP_MEMBERS_PAGE + 1], ["all", 60, GROUP_MEMBERS_PAGE, GROUP_MEMBERS_PAGE + 1]]);
  });

  it("un filtro o una página que no existen se explican; un grupo de otra cuenta o un id mal escrito, «no existe»", async () => {
    const { services } = setup();
    await expect(services.page(OWNER, GROUP, { filter: "vip" })).rejects.toThrow("Elige a quiénes ver");
    await expect(services.page(OWNER, GROUP, { offset: "-1" })).rejects.toThrow("no existe");
    await expect(services.page({ ...OWNER, tenantId: "tenant-b" }, GROUP, {})).rejects.toThrow("Ese grupo no existe.");
    await expect(services.page(OWNER, "no-es-un-id", {})).rejects.toThrow("Ese grupo no existe.");
  });
});

describe("ponerles una etiqueta", () => {
  it("va por tandas y dice cuántos faltan; la siguiente sigue donde quedó, sin repetir", async () => {
    const pending = Array.from({ length: GROUP_LABEL_BATCH + 30 }, (_, i) => `57301${String(i).padStart(7, "0")}`);
    const { services, tag } = setup([], pending);
    expect(await services.label(OWNER, GROUP, { filter: "nonBuyers", label: "  Grupo 3   no compró " })).toEqual({ label: "Grupo 3 no compró", labeled: GROUP_LABEL_BATCH, remaining: 30 });
    expect(await services.label(OWNER, GROUP, { filter: "nonBuyers", label: "Grupo 3 no compró" })).toEqual({ label: "Grupo 3 no compró", labeled: 30, remaining: 0 });
    expect(await services.label(OWNER, GROUP, { filter: "nonBuyers", label: "Grupo 3 no compró" })).toEqual({ label: "Grupo 3 no compró", labeled: 0, remaining: 0 });
    expect(tag).toHaveBeenCalledTimes(GROUP_LABEL_BATCH + 30);
    expect(new Set(tag.mock.calls.map((call) => call[1])).size).toBe(GROUP_LABEL_BATCH + 30);
  });

  it("pide un nombre de 1 a 40 caracteres y un filtro válido", async () => {
    const { services, tag } = setup([], ["573010000001"]);
    await expect(services.label(OWNER, GROUP, { filter: "nonBuyers", label: "  " })).rejects.toThrow("nombre de la etiqueta");
    await expect(services.label(OWNER, GROUP, { filter: "nonBuyers", label: "x".repeat(41) })).rejects.toThrow("hasta 40");
    await expect(services.label(OWNER, GROUP, { filter: "todos", label: "VIP" })).rejects.toThrow("Elige a quiénes");
    expect(tag).not.toHaveBeenCalled();
  });
});

describe("descargarlos", () => {
  it("una fila por miembro en la hora de la empresa, el número como texto y una columna de monto por moneda", async () => {
    const rows = [
      member(1, { isAdmin: true, bought: [{ currency: "COP", amount: 49900 }, { currency: "USD", amount: 12.5 }] }),
      member(2, { joinedAt: null, leftAt: "2026-11-08T02:10:00.000Z", name: null, isOwnNumber: true })
    ];
    const { services } = setup(rows);
    const table = await services.export(OWNER, GROUP, "all");
    expect(table.name).toBe("miembros_Lanzamiento #3_todos");
    expect(table.columns).toEqual(["Nombre", "Teléfono", "País", "Administrador", "Tu número", "Entró", "Salió", "Compró en el grupo", "Monto COP", "Monto USD"]);
    expect(table.rows).toEqual([
      ["Cliente 1", "57 300 000 0001", "CO", "Sí", "No", "2026-11-05 10:30", null, "Sí", 49900, 12.5],
      [null, "57 300 000 0002", "CO", "No", "Sí", "Ya estaba", "2026-11-07 21:10", "No", null, null]
    ]);
    expect(table.truncated).toBe(false);
  });

  it("sin permiso de ventas, la descarga no trae columnas de plata", async () => {
    const { services } = setup();
    const table = await services.export({ ...OWNER, canSeeSales: false }, GROUP, "buyers");
    expect(table.columns).toEqual(["Nombre", "Teléfono", "País", "Administrador", "Tu número", "Entró", "Salió"]);
    expect(table.rows.every((row) => row.length === 7)).toBe(true);
  });
});
