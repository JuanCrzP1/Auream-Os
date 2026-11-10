import { vi } from "vitest";
import type { BoardResponse, DealCard, PipelineSummary } from "@contracts/CrmContracts";
import type { ContactCrmResponse, FollowUpSummary } from "@contracts/CrmActivityContracts";

// Una API falsa del CRM para las pruebas de la web: un embudo, su tablero,
// la ficha de un cliente y sus seguimientos. Anota cada llamada.

export const reply = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

const stage = (id: string, name: string, color: string, outcome: "open" | "won" | "lost", position: number) => ({ id, labelId: `l-${id}`, name, color, outcome, position });

export const PIPELINE: PipelineSummary = {
  id: "p1",
  name: "Ventas de video",
  stages: [stage("s1", "Nuevo", "#8b5cf6", "open", 0), stage("s2", "Pidió precio", "#4f6bed", "open", 1), stage("s3", "Pagó", "#0d9488", "won", 2), stage("s4", "Perdido", "#e11d48", "lost", 3)],
  entryStageId: "s1",
  saleStageId: "s3",
  defaultProductId: null,
  autoAssign: false
};

export const card = (over: Partial<DealCard>): DealCard => ({
  contactId: "c1",
  name: "Laura Gómez",
  phone: "573001112233",
  country: "CO",
  stageId: "s2",
  value: { amount: 49900, currency: "COP" },
  productName: "Video personalizado",
  ownerId: "u1",
  ownerName: "Camilo",
  nextFollowUp: null,
  lastMessageAt: new Date(Date.now() - 12 * 60_000).toISOString(),
  enteredAt: new Date().toISOString(),
  ...over
});

export const BOARD: BoardResponse = {
  pipelineId: "p1",
  columns: [
    { stageId: "s1", count: 3, totals: [], cards: [card({ contactId: "c2", name: "Pedro Ríos", stageId: "s1", value: null, productName: null, ownerId: null, ownerName: null })] },
    { stageId: "s2", count: 1, totals: [{ amount: 49900, currency: "COP" }], cards: [card({})] },
    { stageId: "s3", count: 1, totals: [{ amount: 64900, currency: "COP" }], cards: [card({ contactId: "c3", name: "Ana", stageId: "s3", value: { amount: 64900, currency: "COP" } })] },
    { stageId: "s4", count: 0, totals: [], cards: [] }
  ],
  metrics: { openTotals: [{ amount: 49900, currency: "COP" }], openCount: 4, wonTotals: [{ amount: 64900, currency: "COP" }], wonCount: 1, closeRate: 0.2, avgDaysToClose: 2.4, lostCount: 0, advance: [0.4, 0.5] }
};

export const FOLLOW_UP: FollowUpSummary = { id: "f1", contactId: "c1", contactName: "Laura Gómez", title: "Llamar a Laura", dueAt: new Date(Date.now() - 3_600_000).toISOString(), assigneeId: "u1", assigneeName: "Camilo", doneAt: null, doneByName: null };

export const CONTACT_CRM: ContactCrmResponse = {
  deals: [{ pipelineId: "p1", stageId: "s2", value: { amount: 49900, currency: "COP" }, productId: null, productName: "Video personalizado", ownerId: "u1", ownerName: "Camilo", enteredAt: new Date().toISOString() }],
  followUps: [FOLLOW_UP],
  events: [{ id: "e1", kind: "stage", pipelineId: "p1", fromStageId: "s1", toStageId: "s2", source: "flow", actorName: null, flowName: "Bienvenida", detail: null, createdAt: new Date().toISOString() }]
};

export interface CrmStub {
  readonly calls: Array<{ method: string; path: string; body: unknown }>;
}

export function stubCrmApi({ pipelines = [PIPELINE], canWrite = true, canManage = true } = {}): CrmStub {
  const calls: CrmStub["calls"] = [];
  let current = [...pipelines];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    const path = url.pathname;
    calls.push({ method, path: `${path}${url.search}`, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (path === "/crm/pipelines" && method === "GET") return reply(200, { pipelines: current, members: [{ userId: "u1", name: "Camilo", photoUrl: null }, { userId: "u2", name: "Sofía", photoUrl: null }], canWrite, canManage });
    if (path === "/crm/pipelines/starter") {
      current = [PIPELINE];
      return reply(201, PIPELINE);
    }
    if (path.startsWith("/crm/pipelines/p1/board")) return reply(200, BOARD);
    if (path.includes("/cards")) return reply(200, { cards: BOARD.columns.find((column) => path.includes(`/stages/${column.stageId}/`))?.cards ?? [], nextOffset: null });
    if (path.endsWith("/stage") && method === "PUT") return reply(204);
    if (path.startsWith("/crm/pipelines/p1/deals/") && method === "PATCH") return reply(200, CONTACT_CRM.deals[0]);
    if (path === "/crm/pipelines/p1" && method === "PATCH") return reply(200, PIPELINE);
    if (path.startsWith("/crm/contacts/")) return reply(200, CONTACT_CRM);
    if (path === "/crm/follow-ups" && method === "GET") return reply(200, { followUps: url.searchParams.get("bucket") === "overdue" ? [FOLLOW_UP] : [], counts: { overdue: 1, today: 0, upcoming: 2 } });
    if (path.startsWith("/crm/follow-ups")) return reply(method === "POST" ? 201 : 200, FOLLOW_UP);
    if (path === "/products") return reply(200, { products: [], canManage: true });
    if (path.startsWith("/contacts/")) return reply(200, { id: "c1", channel: "whatsapp", name: "Laura Gómez", phone: "573001112233", email: null, labels: [{ id: "l-s2", name: "Pidió precio", color: "#4f6bed" }], customFields: {}, createdAt: "x", updatedAt: "x" });
    return reply(404, { message: "no" });
  }));
  return { calls };
}
