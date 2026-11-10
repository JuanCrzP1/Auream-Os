import { describe, expect, it } from "vitest";
import { InvitationServices } from "../../domains/team/application/InvitationServices.js";
import { TeamServices } from "../../domains/team/application/TeamServices.js";
import { InMemoryTeamStore } from "../../infrastructure/persistence/memory/InMemoryTeamRepositories.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { ConflictError } from "../../platform/observability/errors/ConflictError.js";
import { NotFoundError } from "../../platform/observability/errors/NotFoundError.js";

// ---------------------------------------------------------------------------
// La invitación vista por quien la recibe: el enlace muestra la empresa, quién
// invita y el rol (sin sesión); aceptarla exige el enlace Y entrar con el
// correo invitado. Usada, vencida o cancelada, no sirve.
// ---------------------------------------------------------------------------

const T = "11111111-1111-1111-1111-111111111111";
const OWNER = "aaaaaaaa-0000-4000-8000-000000000001";
const MARIA = "aaaaaaaa-0000-4000-8000-000000000004";
const OTHER = "aaaaaaaa-0000-4000-8000-000000000005";
const NOW = new Date("2026-11-10T12:00:00.000Z");

function setup() {
  let now = NOW;
  const clock = () => now;
  const store = new InMemoryTeamStore()
    .addCompany(T, "Dilo Cantando", "https://blob/logo.png")
    .addMember(T, { userId: OWNER, displayName: "Camilo", email: "camilo@x.co" }, "tenant_owner");
  const team = new TeamServices(store.members, store.invitations, clock);
  const invitations = new InvitationServices(store.invitations, clock);
  return { store, team, invitations, later: (ms: number) => (now = new Date(NOW.getTime() + ms)) };
}

describe("InvitationServices — abrir el enlace", () => {
  it("muestra la empresa, quién invita, el rol y el correo a medias", async () => {
    const { team, invitations } = setup();
    const { token } = await team.invite({ tenantId: T, userId: OWNER }, { email: "maria@x.co", role: "operator" });

    expect(await invitations.preview(token)).toEqual({
      status: "pending",
      companyName: "Dilo Cantando",
      companyLogoUrl: "https://blob/logo.png",
      inviterName: "Camilo",
      role: "operator",
      emailHint: "ma***@x.co",
      expiresAt: "2026-11-17T12:00:00.000Z"
    });
  });

  it("un enlace que no existe o está mal escrito no revela nada", async () => {
    const { invitations } = setup();
    await expect(invitations.preview("x".repeat(43))).rejects.toBeInstanceOf(NotFoundError);
    await expect(invitations.preview("corto")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("InvitationServices — aceptar", () => {
  it("con el correo invitado entra a la cuenta con su rol; volver a tocar «Unirme» no es un error", async () => {
    const { store, team, invitations } = setup();
    const { token } = await team.invite({ tenantId: T, userId: OWNER }, { email: "maria@x.co", role: "operator" });

    expect(await invitations.accept(token, { userId: MARIA, email: "maria@x.co" })).toEqual({ tenantId: T, tenantName: "Dilo Cantando", role: "operator", joined: true });
    expect(store.membership(T, MARIA)).toMatchObject({ role: "operator", status: "active" });
    expect((await invitations.preview(token)).status).toBe("accepted");
    expect(await invitations.accept(token, { userId: MARIA, email: "maria@x.co" })).toMatchObject({ joined: false });
  });

  it("con otro correo, o sin correo confirmado, no entra (un enlace reenviado no le sirve a otro)", async () => {
    const { store, team, invitations } = setup();
    const { token } = await team.invite({ tenantId: T, userId: OWNER }, { email: "maria@x.co", role: "operator" });

    await expect(invitations.accept(token, { userId: OTHER, email: "otro@x.co" })).rejects.toThrow(/ma\*\*\*@x\.co/);
    await expect(invitations.accept(token, { userId: OTHER })).rejects.toBeInstanceOf(AccessError);
    expect(store.membership(T, OTHER)).toBeUndefined();
  });

  it("usada por otra persona, cancelada o vencida, ya no sirve", async () => {
    const { team, invitations, later } = setup();
    const owner = { tenantId: T, userId: OWNER };

    const used = await team.invite(owner, { email: "maria@x.co", role: "operator" });
    await invitations.accept(used.token, { userId: MARIA, email: "maria@x.co" });
    await expect(invitations.accept(used.token, { userId: OTHER, email: "maria@x.co" })).rejects.toThrow(/ya se usó/);

    const cancelled = await team.invite(owner, { email: "pedro@x.co", role: "viewer" });
    await team.revoke(owner, cancelled.invitation.id);
    await expect(invitations.accept(cancelled.token, { userId: OTHER, email: "pedro@x.co" })).rejects.toThrow(/cancelada/);

    const expiring = await team.invite(owner, { email: "sofia@x.co", role: "viewer" });
    later(8 * 24 * 60 * 60 * 1000);
    expect((await invitations.preview(expiring.token)).status).toBe("expired");
    await expect(invitations.accept(expiring.token, { userId: OTHER, email: "sofia@x.co" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("si ya era miembro conserva su rol; si había salido, vuelve con el rol invitado", async () => {
    const { store, team, invitations } = setup();
    const owner = { tenantId: T, userId: OWNER };
    store.addMember(T, { userId: OTHER, displayName: "Sin correo", email: null }, "viewer");

    const again = await team.invite(owner, { email: "otro@x.co", role: "tenant_admin" });
    expect(await invitations.accept(again.token, { userId: OTHER, email: "otro@x.co" })).toMatchObject({ joined: false });
    expect(store.membership(T, OTHER)?.role).toBe("viewer");

    await team.remove(owner, OTHER);
    const back = await team.invite(owner, { email: "otro@x.co", role: "operator" });
    expect(await invitations.accept(back.token, { userId: OTHER, email: "otro@x.co" })).toMatchObject({ joined: true });
    expect(store.membership(T, OTHER)).toMatchObject({ role: "operator", status: "active" });
  });
});
