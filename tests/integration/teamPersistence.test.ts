import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlInvitationRepository } from "../../infrastructure/persistence/sql/SqlInvitationRepository.js";
import { SqlTeamRepository } from "../../infrastructure/persistence/sql/SqlTeamRepository.js";
import { SqlTeamActivityLog } from "../../infrastructure/persistence/sql/SqlTeamActivityLog.js";
import { SqlUserProfileRepository } from "../../infrastructure/persistence/sql/SqlUserProfileRepository.js";
import { InvitationServices } from "../../domains/team/application/InvitationServices.js";
import { TeamServices } from "../../domains/team/application/TeamServices.js";
import { ConflictError } from "../../platform/observability/errors/ConflictError.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Equipo en PostgreSQL (rama `test`): invitar → abrir el enlace → aceptar →
// miembro con su correo; quitar y volver; y la base nunca deja la cuenta sin
// dueño, ni con dos cambios a la vez.
// ---------------------------------------------------------------------------

let sql: SqlClient;
const users: string[] = [];

async function insertTenant(key: string): Promise<string> {
  const result = await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, $2) returning id", [TEST_KEY_PREFIX + key, key]);
  return result.rows[0]!.id;
}

async function addPerson(tenantId: string, role: string, name: string, email: string): Promise<string> {
  const userId = randomUUID();
  users.push(userId);
  await sql.query("insert into memberships (user_id, tenant_id, role) values ($1, $2, $3)", [userId, tenantId, role]);
  await new SqlUserProfileRepository(sql).save({ userId, displayName: name, phone: null, photoPathname: null, photoUrl: null });
  await new SqlUserProfileRepository(sql).recordIdentity(userId, { email });
  return userId;
}

const services = () => {
  const invitations = new SqlInvitationRepository(sql);
  const log = new SqlTeamActivityLog(sql);
  return { team: new TeamServices(new SqlTeamRepository(sql), invitations, log), invitations: new InvitationServices(invitations, log) };
};

beforeAll(() => {
  sql = createTestSqlClient();
});
beforeEach(async () => {
  await cleanupTestData(sql);
});
afterAll(async () => {
  await cleanupTestData(sql);
  if (users.length) await sql.query("delete from user_profiles where user_id = any($1::uuid[])", [users]);
  await sql.close();
});

describe("Equipo en PostgreSQL", () => {
  it("invitar, abrir el enlace y aceptar deja a la persona en el equipo con su rol; el secreto nunca se guarda", async () => {
    const tenantId = await insertTenant("equipo-a");
    const owner = await addPerson(tenantId, "tenant_owner", "Camilo", "camilo@test.co");
    const { team, invitations } = services();

    const link = await team.invite({ tenantId, userId: owner }, { email: "Maria@Test.co", role: "operator" });
    const stored = await sql.query<{ token_hash: string; email: string }>("select token_hash, email from team_invitations where id = $1", [link.invitation.id]);
    expect(stored.rows[0]).toMatchObject({ email: "maria@test.co" });
    expect(stored.rows[0]!.token_hash).not.toContain(link.token);

    expect(await invitations.preview(link.token)).toMatchObject({ status: "pending", companyName: "equipo-a", inviterName: "Camilo", emailHint: "ma***@test.co" });

    const maria = randomUUID();
    users.push(maria);
    await new SqlUserProfileRepository(sql).recordIdentity(maria, { email: "maria@test.co", name: "María" });
    expect(await invitations.accept(link.token, { userId: maria, email: "maria@test.co" })).toMatchObject({ tenantId, role: "operator", joined: true });

    // El nombre del registro llena el que falta, sin pisar el elegido en Mi perfil.
    await new SqlUserProfileRepository(sql).recordIdentity(owner, { email: "camilo@test.co", name: "Otro nombre" });
    const view = await team.list({ tenantId, userId: owner });
    expect(view.members.map((m) => [m.displayName, m.email, m.role])).toEqual([
      ["Camilo", "camilo@test.co", "tenant_owner"],
      ["María", "maria@test.co", "operator"]
    ]);
    expect(view.invitations).toEqual([]);

    // La actividad lo cuenta con nombres, y la «última vez» se anota.
    const { entries } = await team.activity({ tenantId, userId: owner });
    expect(entries.map((entry) => [entry.action, entry.actorName, entry.targetName])).toEqual([
      ["joined", "María", "María"],
      ["invited", "Camilo", "maria@test.co"]
    ]);
    await team.touch({ tenantId, userId: maria });
    expect((await team.list({ tenantId, userId: owner })).members.find((m) => m.email === "maria@test.co")?.lastSeenAt).toEqual(expect.any(String));
    await expect(team.invite({ tenantId, userId: owner }, { email: "maria@test.co", role: "viewer" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("quitar revoca el acceso; con una invitación nueva vuelve con el rol invitado", async () => {
    const tenantId = await insertTenant("equipo-b");
    const owner = await addPerson(tenantId, "tenant_owner", "Camilo", "camilo2@test.co");
    const ana = await addPerson(tenantId, "tenant_admin", "Ana", "ana@test.co");
    const { team, invitations } = services();

    await team.remove({ tenantId, userId: owner }, ana);
    const revoked = await sql.query<{ status: string }>("select status from memberships where tenant_id = $1 and user_id = $2", [tenantId, ana]);
    expect(revoked.rows[0]!.status).toBe("revoked");

    const link = await team.invite({ tenantId, userId: owner }, { email: "ana@test.co", role: "viewer" });
    expect(await invitations.accept(link.token, { userId: ana, email: "ana@test.co" })).toMatchObject({ joined: true });
    const back = await sql.query<{ status: string; role: string }>("select status, role from memberships where tenant_id = $1 and user_id = $2", [tenantId, ana]);
    expect(back.rows[0]).toEqual({ status: "active", role: "viewer" });
  });

  it("la base nunca deja la cuenta sin dueño, aunque dos dueños se bajen a la vez", async () => {
    const tenantId = await insertTenant("equipo-c");
    const first = await addPerson(tenantId, "tenant_owner", "Uno", "uno@test.co");
    const second = await addPerson(tenantId, "tenant_owner", "Dos", "dos@test.co");
    const repo = new SqlTeamRepository(sql);

    const outcomes = await Promise.all([repo.changeRole(tenantId, first, "tenant_admin"), repo.changeRole(tenantId, second, "tenant_admin")]);
    expect([...outcomes].sort()).toEqual(["changed", "last_owner"]);
    const owners = await sql.query<{ total: number }>("select count(*)::int as total from memberships where tenant_id = $1 and status = 'active' and role = 'tenant_owner'", [tenantId]);
    expect(owners.rows[0]!.total).toBe(1);
  });
});
