import { vi } from "vitest";
import type { ContactSummary, LabelSummary } from "@contracts/ContactContracts";
import type { ContactFieldSummary } from "@contracts/ContactFieldContracts";
import type { FieldOrigin } from "@contracts/ContactFieldValueContracts";

// ---------------------------------------------------------------------------
// API falsa CON ESTADO de contactos, etiquetas y la ficha (Campos del
// cliente): lo que la pantalla muestra después de una acción sale de volver a
// pedirlo, igual que en producción.
// ---------------------------------------------------------------------------

export const VIP: LabelSummary = { id: "l1", name: "VIP", color: "#ef4444" };
export const LEAD: LabelSummary = { id: "l2", name: "Lead", color: "#3b82f6" };

export function contact(overrides: Partial<ContactSummary> & Pick<ContactSummary, "id">): ContactSummary {
  return {
    channel: "whatsapp",
    name: null,
    phone: null,
    email: null,
    labels: [],
    customFields: {},
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides
  };
}

const reply = (status: number, body?: unknown) =>
  ({
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body ?? {})
  }) as unknown as Response;

export function stubContactsApi(
  seed: { contacts?: ContactSummary[]; labels?: LabelSummary[]; fields?: ContactFieldSummary[]; origins?: Record<string, FieldOrigin>; canManageFields?: boolean } = {}
) {
  let contacts = [...(seed.contacts ?? [])];
  let labels = [...(seed.labels ?? [])];
  const fields = [...(seed.fields ?? [])];

  const withCounts = () => labels.map((label) => ({ ...label, contactCount: contacts.filter((c) => c.labels.some((l) => l.id === label.id)).length }));

  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const path = url.pathname;

    if (path === "/contact-fields" && method === "GET") return reply(200, { fields, system: [], totalContacts: contacts.length, undefinedKeys: 0, canManage: seed.canManageFields ?? true });
    const values = /^\/contact-fields\/values\/([^/]+)$/.exec(path);
    if (values && method === "GET") return reply(200, { values: contacts.find((c) => c.id === values[1])?.customFields ?? {}, origins: seed.origins ?? {}, canEdit: true });
    if (values && method === "PATCH") {
      const changes = body["changes"] as Record<string, string | number | boolean | null>;
      contacts = contacts.map((c) => {
        if (c.id !== values[1]) return c;
        const next: Record<string, string | number | boolean> = { ...c.customFields };
        for (const [key, value] of Object.entries(changes)) value === null ? delete next[key] : (next[key] = value);
        return { ...c, customFields: next };
      });
      return reply(200, { values: contacts.find((c) => c.id === values[1])?.customFields ?? {}, origins: {}, canEdit: true });
    }
    if (path.endsWith("/labels") && method === "GET") return reply(200, { labels: withCounts() });
    if (path.endsWith("/labels") && method === "POST") {
      const name = String(body["name"]).trim();
      if (labels.some((label) => label.name.toLowerCase() === name.toLowerCase())) return reply(409, { message: "Ya existe una etiqueta con ese nombre." });
      const created = { id: `l${labels.length + 10}`, name, color: String(body["color"]) };
      labels.push(created);
      return reply(201, created);
    }
    const label = /\/labels\/([^/]+)$/.exec(path);
    if (label && method === "PATCH") {
      labels = labels.map((l) => (l.id === label[1] ? { ...l, ...(body as Partial<LabelSummary>) } : l));
      return reply(200, labels.find((l) => l.id === label[1]));
    }
    if (label && method === "DELETE") {
      labels = labels.filter((l) => l.id !== label[1]);
      contacts = contacts.map((c) => ({ ...c, labels: c.labels.filter((l) => l.id !== label[1]) }));
      return reply(204);
    }

    if (path.endsWith("/contacts") && method === "GET") {
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const labelId = url.searchParams.get("labelId");
      const found = contacts
        .filter((c) => !search || [c.name, c.phone, c.email].some((v) => v?.toLowerCase().includes(search)))
        .filter((c) => !labelId || c.labels.some((l) => l.id === labelId));
      return reply(200, { contacts: found, page: 1, hasMore: false });
    }
    if (path.endsWith("/contacts") && method === "POST") {
      const created = contact({ id: `c${contacts.length + 10}`, phone: String(body["phone"]).replace(/\D/g, ""), name: (body["name"] as string | undefined) ?? null });
      contacts.push(created);
      return reply(201, created);
    }
    const one = /\/contacts\/([^/]+)(\/labels)?$/.exec(path);
    if (one && method === "PATCH") {
      contacts = contacts.map((c) => (c.id === one[1] ? { ...c, ...(body as Partial<ContactSummary>) } : c));
      return reply(200, contacts.find((c) => c.id === one[1]));
    }
    if (one?.[2] && method === "PUT") {
      const ids = body["labelIds"] as string[];
      contacts = contacts.map((c) => (c.id === one[1] ? { ...c, labels: labels.filter((l) => ids.includes(l.id)) } : c));
      return reply(200, contacts.find((c) => c.id === one[1]));
    }
    return reply(404, { message: "no existe" });
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, contacts: () => contacts, labels: () => labels };
}
