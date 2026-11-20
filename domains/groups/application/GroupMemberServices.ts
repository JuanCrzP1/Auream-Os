import { countryOfPhone, phoneText } from "../../../contracts/Countries";
import {
  GROUP_LABEL_BATCH,
  GROUP_MEMBER_FILTERS,
  GROUP_MEMBERS_EXPORT_MAX,
  GROUP_MEMBERS_PAGE,
  type GroupMemberFilter,
  type GroupMembersPage,
  type LabelGroupMembersResponse
} from "../../../contracts/GroupMemberContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import type { GroupEngine } from "./GroupEngine";
import type { GroupMemberReader, MemberRow } from "./GroupMemberPorts";

// ---------------------------------------------------------------------------
// Los miembros de un grupo: verlos (con lo que compró cada uno mientras
// estaba), ponerles una etiqueta por tandas (sigue hasta que no falte nadie y
// nunca repite) y descargarlos. Quién puede qué lo decide la ruta; aquí solo
// se esconde la plata a quien no ve ventas. La descarga devuelve una TABLA: el
// archivo (y su registro de auditoría) es asunto de la API.
// ---------------------------------------------------------------------------

export interface GroupMemberActor {
  readonly tenantId: string;
  /** Ve ventas (`sales.read`): lo que compró cada uno. */
  readonly canSeeSales: boolean;
  /** Grupos y contactos para editar: puede etiquetarlos. */
  readonly canLabel: boolean;
  /** Dueño o administrador: puede descargarlos. */
  readonly canExport: boolean;
}

export interface MemberExportTable {
  /** «miembros_Lanzamiento_3_no_compraron» sin la extensión. */
  readonly name: string;
  readonly columns: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<ReadonlyArray<string | number | null>>;
  readonly truncated: boolean;
}

const FILTER_NAME: Readonly<Record<GroupMemberFilter, string>> = { all: "todos", buyers: "compraron", nonBuyers: "no_compraron", left: "salieron", admins: "administradores" };
const MAX_OFFSET = 100_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SEARCH = 60;

function filterOf(value: unknown): GroupMemberFilter {
  if (value === undefined || value === null || value === "") return "all";
  if (typeof value === "string" && (GROUP_MEMBER_FILTERS as ReadonlyArray<string>).includes(value)) return value as GroupMemberFilter;
  throw new ValidationError("Elige a quiénes ver: todos, compraron, no compraron, salieron o administradores.");
}

function labelOf(value: unknown): string {
  const label = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (label.length < 1 || label.length > 40) throw new ValidationError("Escribe el nombre de la etiqueta (hasta 40 caracteres).");
  return label;
}

/** «2026-11-10 09:05» en la hora de la empresa. */
function localTime(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export class GroupMemberServices {
  public constructor(
    private readonly engine: Pick<GroupEngine, "groups" | "results" | "numbers" | "labeler" | "timezoneOf">,
    private readonly members: GroupMemberReader
  ) {}

  public async page(actor: GroupMemberActor, groupId: string, query: { readonly filter?: unknown; readonly search?: unknown; readonly offset?: unknown }): Promise<GroupMembersPage> {
    const group = await this.require(actor.tenantId, groupId);
    const filter = filterOf(query.filter);
    const search = typeof query.search === "string" ? query.search.trim().slice(0, MAX_SEARCH) || null : null;
    const offset = Number(query.offset ?? 0);
    if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) throw new ValidationError("La página pedida no existe.");
    const [page, numbers, phones] = await Promise.all([
      this.members.page(actor.tenantId, group.id, { filter, search, offset, limit: GROUP_MEMBERS_PAGE + 1 }),
      this.engine.results.groups(actor.tenantId, [group.id], null),
      this.engine.numbers.list(actor.tenantId)
    ]);
    return {
      group: { id: group.id, name: group.name, position: group.position, connectionName: phones.find((p) => p.id === group.connectionId)?.name ?? "", members: group.members, syncedAt: group.syncedAt },
      counts: page.counts,
      hidden: page.hidden,
      // Lo vendido sale de la MISMA cuenta que la tarjeta del grupo.
      revenue: actor.canSeeSales ? (numbers.get(group.id)?.revenue ?? []) : null,
      members: page.rows.slice(0, GROUP_MEMBERS_PAGE).map((row) => ({ ...row, bought: actor.canSeeSales ? row.bought : null })),
      nextOffset: page.rows.length > GROUP_MEMBERS_PAGE ? offset + GROUP_MEMBERS_PAGE : null,
      canLabel: actor.canLabel,
      canExport: actor.canExport
    };
  }

  /** Una tanda: etiqueta a los que aún no la tienen (nunca tus números) y dice cuántos faltan. */
  public async label(actor: GroupMemberActor, groupId: string, body: { readonly filter?: unknown; readonly label?: unknown }): Promise<LabelGroupMembersResponse> {
    const group = await this.require(actor.tenantId, groupId);
    const filter = filterOf(body.filter);
    const label = labelOf(body.label);
    const { phones, total } = await this.members.toLabel(actor.tenantId, group.id, filter, label, GROUP_LABEL_BATCH);
    for (const phone of phones) await this.engine.labeler.tag(actor.tenantId, phone, label);
    return { label, labeled: phones.length, remaining: Math.max(0, total - phones.length) };
  }

  public async export(actor: GroupMemberActor, groupId: string, filterValue: unknown): Promise<MemberExportTable> {
    const group = await this.require(actor.tenantId, groupId);
    const filter = filterOf(filterValue);
    const [page, timezone] = await Promise.all([
      this.members.page(actor.tenantId, group.id, { filter, search: null, offset: 0, limit: GROUP_MEMBERS_EXPORT_MAX + 1 }),
      this.engine.timezoneOf(actor.tenantId)
    ]);
    const rows = page.rows.slice(0, GROUP_MEMBERS_EXPORT_MAX);
    const currencies = actor.canSeeSales ? [...new Set(rows.flatMap((row) => row.bought.map((entry) => entry.currency)))].sort() : [];
    const amount = (row: MemberRow, currency: string) => row.bought.find((entry) => entry.currency === currency)?.amount ?? null;
    return {
      name: `miembros_${group.name}_${FILTER_NAME[filter]}`,
      columns: ["Nombre", "Teléfono", "País", "Administrador", "Tu número", "Entró", "Salió", ...(actor.canSeeSales ? ["Compró en el grupo", ...currencies.map((currency) => `Monto ${currency}`)] : [])],
      rows: rows.map((row) => [
        row.name,
        phoneText(row.phone),
        countryOfPhone(row.phone),
        row.isAdmin ? "Sí" : "No",
        row.isOwnNumber ? "Sí" : "No",
        localTime(row.joinedAt, timezone) ?? "Ya estaba",
        localTime(row.leftAt, timezone),
        ...(actor.canSeeSales ? [row.bought.length > 0 ? "Sí" : "No", ...currencies.map((currency) => amount(row, currency))] : [])
      ]),
      truncated: page.rows.length > GROUP_MEMBERS_EXPORT_MAX
    };
  }

  private async require(tenantId: string, groupId: string) {
    // Un id mal escrito (p. ej. desde el MCP) es «no existe», nunca un error de la base.
    const group = UUID.test(groupId) ? await this.engine.groups.find(tenantId, groupId) : null;
    if (!group) throw new NotFoundError("Ese grupo no existe.");
    return group;
  }
}
