import { describe, expect, it } from "vitest";
import { TeamServices } from "../../domains/team/application/TeamServices.js";
import { hashInvitationToken } from "../../domains/team/application/InvitationToken.js";
import { InMemoryTeamStore } from "../../infrastructure/persistence/memory/InMemoryTeamRepositories.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { ConflictError } from "../../platform/observability/errors/ConflictError.js";
import { NotFoundError } from "../../platform/observability/errors/NotFoundError.js";
import { ValidationError } from "../../platform/observability/errors/ValidationError.js";

// ---------------------------------------------------------------------------
// Equipo visto por quien lo administra: ver, invitar con enlace, renovar,
// cancelar, cambiar roles y quitar, siempre con las reglas de `TeamPolicy`.
// ---------------------------------------------------------------------------

const T = "11111111-1111-1111-1111-111111111111";
const OWNER = "aaaaaaaa-0000-4000-8000-000000000001";
const ADMIN = "aaaaaaaa-0000-4000-8000-000000000002";
const AGENT = "aaaaaaaa-0000-4000-8000-000000000003";
const NOW = new Date("2026-11-10T12:00:00.000Z");

function setup() {
  const store = new InMemoryTeamStore()
    .addCompany(T, "Dilo Cantando")
    .addMember(T, { userId: OWNER, displayName: "Camilo", email: "camilo@x.co" }, "tenant_owner", "2026-11-01T00:00:00.000Z")
    .addMember(T, { userId: ADMIN, displayName: "Luis", email: "luis@x.co" }, "tenant_admin", "2026-11-02T00:00:00.000Z")
    .addMember(T, { userId: AGENT, displayName: "Ana", email: "ana@x.co" }, "operator", "2026-11-03T00:00:00.000Z");
  let issued = 0;
  const team = new TeamServices(store.members, store.invitations, () => NOW, () => `token${++issued}`.padEnd(43, "x"));
  return { store, team };
}

const as = (userId: string) => ({ tenantId: T, userId });

describe("TeamServices — ver", () => {
  it("dueños primero, quién eres y a quién puedes tocar", async () => {
    const view = await setup().team.list(as(ADMIN));
    expect(view.members.map((m) => [m.displayName, m.role, m.isYou, m.canManage])).toEqual([
      ["Camilo", "tenant_owner", false, false],
      ["Luis", "tenant_admin", true, false],
      ["Ana", "operator", false, true]
    ]);
    expect(view.myRole).toBe("tenant_admin");
    expect(view.assignableRoles).toEqual(["tenant_admin", "operator", "viewer"]);
  });

  it("quien no pertenece a la cuenta no ve nada", async () => {
    await expect(setup().team.list(as("bbbbbbbb-0000-4000-8000-000000000009"))).rejects.toBeInstanceOf(AccessError);
  });
});

describe("TeamServices — invitar", () => {
  it("entrega el enlace una sola vez, guarda solo su huella y vence a los 7 días", async () => {
    const { store, team } = setup();
    const link = await team.invite(as(OWNER), { email: "  Maria@X.co ", role: "operator" });

    const saved = store.invitationsById.get(link.invitation.id)!;
    expect(saved.email).toBe("maria@x.co");
    expect(saved.tokenHash).toBe(hashInvitationToken(link.token));
    expect(JSON.stringify(saved)).not.toContain(link.token);
    expect(link.invitation).toMatchObject({ role: "operator", invitedByName: "Camilo", expired: false, expiresAt: "2026-11-17T12:00:00.000Z" });
    expect((await team.list(as(OWNER))).invitations).toHaveLength(1);
  });

  it("invitar de nuevo al mismo correo renueva la invitación: enlace y rol nuevos, una sola pendiente", async () => {
    const { store, team } = setup();
    const first = await team.invite(as(OWNER), { email: "maria@x.co", role: "operator" });
    const second = await team.invite(as(OWNER), { email: "maria@x.co", role: "viewer" });

    expect(second.invitation.id).toBe(first.invitation.id);
    expect(second.token).not.toBe(first.token);
    expect(store.invitationsById.get(first.invitation.id)).toMatchObject({ role: "viewer", tokenHash: hashInvitationToken(second.token) });
    expect((await team.list(as(OWNER))).invitations).toHaveLength(1);
  });

  it("no invita a quien ya está, ni con un rol que no puede dar, ni con un correo inválido", async () => {
    const { team } = setup();
    await expect(team.invite(as(OWNER), { email: "ANA@x.co", role: "viewer" })).rejects.toBeInstanceOf(ConflictError);
    await expect(team.invite(as(ADMIN), { email: "nuevo@x.co", role: "tenant_owner" })).rejects.toBeInstanceOf(AccessError);
    await expect(team.invite(as(AGENT), { email: "nuevo@x.co", role: "viewer" })).rejects.toBeInstanceOf(AccessError);
    await expect(team.invite(as(OWNER), { email: "nuevo", role: "viewer" })).rejects.toBeInstanceOf(ValidationError);
    await expect(team.invite(as(OWNER), { email: "nuevo@x.co", role: "api_client" as never })).rejects.toBeInstanceOf(ValidationError);
  });

  it("renovar da un enlace nuevo; cancelar la saca de la lista; un administrador no toca invitaciones de dueños", async () => {
    const { store, team } = setup();
    const link = await team.invite(as(OWNER), { email: "maria@x.co", role: "operator" });
    const renewed = await team.renew(as(ADMIN), link.invitation.id);
    expect(store.invitationsById.get(link.invitation.id)!.tokenHash).toBe(hashInvitationToken(renewed.token));

    await team.revoke(as(OWNER), link.invitation.id);
    expect((await team.list(as(OWNER))).invitations).toEqual([]);
    await expect(team.renew(as(OWNER), link.invitation.id)).rejects.toBeInstanceOf(NotFoundError);

    const coOwner = await team.invite(as(OWNER), { email: "socio@x.co", role: "tenant_owner" });
    await expect(team.revoke(as(ADMIN), coOwner.invitation.id)).rejects.toBeInstanceOf(AccessError);
  });
});

describe("TeamServices — roles y salidas", () => {
  it("el dueño cambia roles; nadie cambia el suyo; el administrador no toca dueños ni nombra dueños", async () => {
    const { store, team } = setup();
    const view = await team.changeRole(as(OWNER), AGENT, { role: "viewer" });
    expect(view.members.find((m) => m.userId === AGENT)?.role).toBe("viewer");
    expect(store.membership(T, AGENT)?.role).toBe("viewer");

    await expect(team.changeRole(as(OWNER), OWNER, { role: "tenant_admin" })).rejects.toBeInstanceOf(AccessError);
    await expect(team.changeRole(as(ADMIN), OWNER, { role: "viewer" })).rejects.toBeInstanceOf(AccessError);
    await expect(team.changeRole(as(ADMIN), AGENT, { role: "tenant_owner" })).rejects.toBeInstanceOf(AccessError);

    await team.changeRole(as(OWNER), ADMIN, { role: "tenant_owner" });
    expect(store.membership(T, ADMIN)?.role).toBe("tenant_owner");
  });

  it("quitar corta el acceso al instante; nadie se quita a sí mismo; el administrador no quita dueños", async () => {
    const { store, team } = setup();
    await team.remove(as(ADMIN), AGENT);
    expect(store.membership(T, AGENT)?.status).toBe("revoked");
    expect((await team.list(as(OWNER))).members.map((m) => m.userId)).toEqual([OWNER, ADMIN]);

    await expect(team.remove(as(OWNER), OWNER)).rejects.toBeInstanceOf(AccessError);
    await expect(team.remove(as(ADMIN), OWNER)).rejects.toBeInstanceOf(AccessError);
    await expect(team.remove(as(OWNER), AGENT)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("la base nunca deja la cuenta sin dueño, aunque dos cambios lleguen a la vez", async () => {
    const { store } = setup();
    expect(await store.members.changeRole(T, OWNER, "tenant_admin")).toBe("last_owner");
    expect(await store.members.removeMember(T, OWNER)).toBe("last_owner");
    expect(store.membership(T, OWNER)).toMatchObject({ role: "tenant_owner", status: "active" });
  });
});
