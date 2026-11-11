import { describe, expect, it, vi } from "vitest";
import { buildFeed, describe as describeSignal, FEED_LIMIT, type Signal } from "../../domains/notifications/domain/Signal.js";
import { NotificationServices } from "../../domains/notifications/application/NotificationServices.js";

// ---------------------------------------------------------------------------
// La campana: cada señal se vuelve un aviso con su texto y la pantalla que lo
// resuelve; lo más reciente primero, hasta 30, y «nuevo» lo que pasó después
// de la última vez que la persona abrió la campana.
// ---------------------------------------------------------------------------

const at = (iso: string) => new Date(iso);

describe("Notificaciones", () => {
  it("cada aviso dice qué pasó y lleva a donde se resuelve", () => {
    expect(describeSignal({ kind: "number_disconnected", id: "c1", name: "Ventas 1", at: at("2026-11-11T10:00:00Z") })).toMatchObject({ title: "Ventas 1 se desconectó", path: "/connections" });
    expect(describeSignal({ kind: "broadcast_auto_paused", id: "b1", name: "Promo", reason: "Más del 5 % de los envíos fallaron.", at: at("2026-11-11T10:00:00Z") })).toMatchObject({ title: "«Promo» se pausó sola", detail: "Más del 5 % de los envíos fallaron.", path: "/broadcasts?id=b1" });
    expect(describeSignal({ kind: "sales_review", count: 1, at: at("2026-11-11T10:00:00Z") }).title).toBe("1 venta espera revisión");
    expect(describeSignal({ kind: "sales_review", count: 3, at: at("2026-11-11T10:00:00Z") })).toMatchObject({ title: "3 ventas esperan revisión", path: "/sales?tab=review" });
    expect(describeSignal({ kind: "follow_ups_due", count: 4, overdue: 1, at: at("2026-11-11T10:00:00Z") })).toMatchObject({ title: "4 seguimientos para hoy", detail: "1 ya está vencido.", path: "/crm?tab=follow-ups" });
    expect(describeSignal({ kind: "group_created", id: "g1", campaignId: "k1", campaign: "Lanzamiento", group: "VIP #2", at: at("2026-11-11T10:00:00Z") })).toMatchObject({ title: "Nuevo grupo: VIP #2", path: "/groups?campaign=k1" });
  });

  it("lo más reciente primero, hasta 30, y «nuevo» lo de después de abrir la campana", () => {
    const signals: Signal[] = [
      { kind: "sales_review", count: 2, at: at("2026-11-10T08:00:00Z") },
      { kind: "number_disconnected", id: "c1", name: "Ventas 1", at: at("2026-11-11T09:00:00Z") }
    ];
    const feed = buildFeed(signals, at("2026-11-10T12:00:00Z"));
    expect(feed.map((item) => [item.kind, item.unread])).toEqual([["number_disconnected", true], ["sales_review", false]]);
    expect(buildFeed(signals, null).every((item) => item.unread)).toBe(true);
    const many = Array.from({ length: 40 }, (_, i): Signal => ({ kind: "number_disconnected", id: `c${i}`, name: `N${i}`, at: at(`2026-11-0${(i % 9) + 1}T00:00:00Z`) }));
    expect(buildFeed(many, null)).toHaveLength(FEED_LIMIT);
  });

  it("sin permisos no lee nada; abrir la campana guarda la hora", async () => {
    const source = { read: vi.fn(async () => [{ kind: "sales_review" as const, count: 1, at: at("2026-11-11T10:00:00Z") }]) };
    const reads = { seenAt: vi.fn(async () => null), markSeen: vi.fn(async () => undefined) };
    const now = at("2026-11-11T12:00:00Z");
    const services = new NotificationServices(source, reads, async () => "America/Bogota", () => now);
    expect(await services.feed({ tenantId: "t", userId: "u", kinds: new Set() })).toEqual({ items: [], unread: 0 });
    expect(source.read).not.toHaveBeenCalled();
    expect((await services.feed({ tenantId: "t", userId: "u", kinds: new Set(["sales_review"]) })).unread).toBe(1);
    expect(source.read).toHaveBeenCalledWith(expect.objectContaining({ timezone: "America/Bogota", now }));
    await services.markSeen({ tenantId: "t", userId: "u", kinds: new Set() });
    expect(reads.markSeen).toHaveBeenCalledWith("t", "u", now);
  });
});
