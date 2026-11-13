import { describe, expect, it } from "vitest";
import { toGroupSummary } from "../../domains/groups/application/groupViews.js";
import type { WaGroup } from "../../domains/groups/application/GroupPorts.js";

// ---------------------------------------------------------------------------
// El enlace de invitación de cada grupo llega a la pantalla («Copiar el enlace
// de este grupo» en la tarjeta), solo si el número conectado administra el
// grupo: si ya no lo administra, el enlace guardado puede no servir.
// ---------------------------------------------------------------------------

const group = (overrides: Partial<WaGroup> = {}): WaGroup => ({
  id: "g1", tenantId: "t", connectionId: "c1", jid: "1203@g.us", name: "VIP #1", description: "", imageUrl: null, members: 2,
  isAdmin: true, announce: true, locked: true, inviteLink: "https://chat.whatsapp.com/abc", campaignId: null, position: null,
  syncedAt: null, lastWelcomeAt: null, createdAt: "2026-11-13T00:00:00Z", ...overrides
});
const names = { numbers: new Map([["c1", "flujo 1"]]), campaigns: new Map() };

describe("el enlace de cada grupo", () => {
  it("llega a la pantalla si administras el grupo", () => {
    expect(toGroupSummary(group(), undefined, names, [])).toMatchObject({ inviteLink: "https://chat.whatsapp.com/abc", connectionName: "flujo 1" });
  });

  it("no llega si ya no eres administrador, ni si WhatsApp aún no lo dio", () => {
    expect(toGroupSummary(group({ isAdmin: false }), undefined, names, []).inviteLink).toBeNull();
    expect(toGroupSummary(group({ inviteLink: null }), undefined, names, []).inviteLink).toBeNull();
  });
});
