import { describe, expect, it, vi } from "vitest";
import { FollowUpServices } from "../../domains/crm/application/FollowUpServices.js";
import type { FollowUpRepository, FollowUpView } from "../../domains/crm/application/CrmRepositories.js";
import { dayBounds, followUpBucket } from "../../domains/crm/domain/FollowUp.js";
import { OWNER, crmWorld } from "./helpers/crmFakes.js";

// ---------------------------------------------------------------------------
// Seguimientos: Vencidos · Hoy · Próximos según el día de la EMPRESA (no el
// del servidor), con responsable del equipo y nunca alguien de solo lectura.
// ---------------------------------------------------------------------------

const CONTACT = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-11-10T22:00:00.000Z"); // 5:00 p. m. en Bogotá

function fakeRepository() {
  const rows = new Map<string, FollowUpView>();
  const repository: FollowUpRepository = {
    find: async (_t, id) => rows.get(id) ?? null,
    list: vi.fn(async () => [...rows.values()]),
    counts: vi.fn(async () => ({ overdue: 1, today: 2, upcoming: 3 })),
    insert: async (row) => void rows.set(row.id, { ...row, contactName: "Laura", assigneeName: row.assigneeId, doneByName: row.doneBy }),
    update: async (row) => void rows.set(row.id, { ...rows.get(row.id)!, ...row }),
    remove: async (_t, id) => rows.delete(id)
  };
  return { repository, rows };
}

function setup() {
  const world = crmWorld();
  world.addContact(CONTACT);
  const { repository, rows } = fakeRepository();
  const services = new FollowUpServices(repository, world.labeler, world.team, async () => "America/Bogota", () => NOW);
  return { services, repository, rows };
}

describe("el día de la empresa", () => {
  it("corta el día en la zona de la empresa", () => {
    expect(dayBounds(NOW, "America/Bogota")).toEqual({ start: new Date("2026-11-10T05:00:00.000Z"), end: new Date("2026-11-11T05:00:00.000Z") });
    expect(dayBounds(new Date("2026-11-11T03:00:00.000Z"), "America/Bogota").start).toEqual(new Date("2026-11-10T05:00:00.000Z"));
    expect(dayBounds(NOW, "Europe/Madrid").start).toEqual(new Date("2026-11-09T23:00:00.000Z"));
  });

  it("agrupa en vencido, hoy, próximo o hecho", () => {
    const at = (dueAt: string, doneAt: string | null = null) => followUpBucket({ dueAt, doneAt }, NOW, "America/Bogota");
    expect(at("2026-11-10T21:00:00.000Z")).toBe("overdue");
    expect(at("2026-11-11T03:00:00.000Z")).toBe("today");
    expect(at("2026-11-11T06:00:00.000Z")).toBe("upcoming");
    expect(at("2026-11-01T00:00:00.000Z", "2026-11-02T00:00:00.000Z")).toBe("done");
  });
});

describe("FollowUpServices", () => {
  it("crea con quien lo pide como responsable; marcar hecho guarda quién y cuándo; deshacer lo limpia", async () => {
    const { services } = setup();
    const created = await services.create(OWNER, { contactId: CONTACT, title: "  Llamar   para cerrar ", dueAt: "2026-11-11T14:00:00.000Z" });
    expect(created).toMatchObject({ title: "Llamar para cerrar", assigneeId: "u-owner", doneAt: null });
    const done = await services.update(OWNER, created.id, { done: true });
    expect(done.doneAt).toBe(NOW.toISOString());
    expect((await services.update(OWNER, created.id, { done: false })).doneAt).toBeNull();
  });

  it("valida cliente, texto, fecha y responsable", async () => {
    const { services } = setup();
    await expect(services.create(OWNER, { contactId: "22222222-2222-4222-8222-222222222222", title: "x", dueAt: NOW.toISOString() })).rejects.toThrow("Ese cliente no existe.");
    await expect(services.create(OWNER, { contactId: CONTACT, title: " ", dueAt: NOW.toISOString() })).rejects.toThrow("Escribe qué hay que hacer.");
    await expect(services.create(OWNER, { contactId: CONTACT, title: "x", dueAt: "mañana" })).rejects.toThrow("Elige cuándo.");
    await expect(services.create(OWNER, { contactId: CONTACT, title: "x", dueAt: "2029-01-01T00:00:00.000Z" })).rejects.toThrow("próximo año");
    await expect(services.create(OWNER, { contactId: CONTACT, title: "x", dueAt: NOW.toISOString(), assigneeId: "u-viewer" })).rejects.toThrow("solo lectura");
  });

  it("la lista pide los de quien pregunta (o los de todos) con el fin del día de la empresa", async () => {
    const { services, repository } = setup();
    const result = await services.list(OWNER, { bucket: "overdue" });
    expect(result.counts).toEqual({ overdue: 1, today: 2, upcoming: 3 });
    expect(repository.list).toHaveBeenCalledWith("tenant-a", expect.objectContaining({ bucket: "overdue", assigneeId: "u-owner", endOfToday: new Date("2026-11-11T05:00:00.000Z") }));
    await services.list(OWNER, { bucket: "raro", assignee: "all" });
    expect(repository.list).toHaveBeenLastCalledWith("tenant-a", expect.objectContaining({ bucket: "today", assigneeId: null }));
  });
});
