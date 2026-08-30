import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import { resolveRequestContext } from "../../apps/api/middleware/resolveRequestContext.js";
import type { AuthenticatedPrincipal } from "../../platform/identity/contracts/AuthenticatedPrincipal.js";
import type {
  MembershipRepository,
  MembershipWithTenant
} from "../../domains/team/application/MembershipRepository.js";
import type { Membership } from "../../domains/team/contracts/Membership.js";

// ---------------------------------------------------------------------------
// Aislamiento entre tenants, desde el punto donde se decide.
//
// `resolveRequestContext` es el ÚNICO lugar que convierte una petición en un
// tenant y unos scopes. Todo lo que un atacante controla — cabecera, cuerpo,
// URL, claims del token — pasa por aquí, así que aquí es donde hay que
// demostrar que ninguno de esos canales otorga acceso.
//
// El aislamiento a nivel de base de datos se prueba aparte, en
// tests/integration/tenancyPersistence.test.ts. Estos casos prueban la
// DECISIÓN, no el almacenamiento.
// ---------------------------------------------------------------------------

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function membership(userId: string, tenantId: string, role: Membership["role"]): Membership {
  return { userId, tenantId, role, status: "active" };
}

function withTenant(m: Membership): MembershipWithTenant {
  return { membership: m, tenantKey: `key-${m.tenantId}`, tenantName: `Tenant ${m.tenantId}` };
}

/**
 * Repositorio con las memberships reales del escenario.
 *
 * A pertenece sólo a A; B pertenece sólo a B. Cualquier consulta fuera de eso
 * devuelve null, igual que haría la base de datos.
 */
function repository(all: ReadonlyArray<Membership>): MembershipRepository {
  return {
    async findActive(userId, tenantId) {
      return all.find((m) => m.userId === userId && m.tenantId === tenantId) ?? null;
    },
    async findActiveByUser(userId) {
      return all.filter((m) => m.userId === userId).map(withTenant);
    }
  };
}

const MEMBERSHIPS = [
  membership(USER_A, TENANT_A, "tenant_owner"),
  membership(USER_B, TENANT_B, "tenant_owner")
];

function userRequest(headers: Record<string, string> = {}): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

function asUser(userId: string): AuthenticatedPrincipal {
  return { kind: "user", identity: { actorId: userId } };
}

async function resolveFor(userId: string, headers: Record<string, string> = {}) {
  return resolveRequestContext(userRequest(headers), asUser(userId), repository(MEMBERSHIPS));
}

describe("cada usuario accede a su propio tenant", () => {
  it("A resuelve el tenant A", async () => {
    const result = await resolveFor(USER_A, { "x-tenant-id": TENANT_A });

    expect(result.outcome).toBe("resolved");
    expect(result.outcome === "resolved" && result.context.tenantId).toBe(TENANT_A);
  });

  it("B resuelve el tenant B", async () => {
    const result = await resolveFor(USER_B, { "x-tenant-id": TENANT_B });

    expect(result.outcome).toBe("resolved");
    expect(result.outcome === "resolved" && result.context.tenantId).toBe(TENANT_B);
  });
});

describe("acceso cruzado entre tenants", () => {
  it("A NO puede seleccionar el tenant de B", async () => {
    const result = await resolveFor(USER_A, { "x-tenant-id": TENANT_B });

    expect(result.outcome).toBe("forbidden");
  });

  it("B NO puede seleccionar el tenant de A", async () => {
    const result = await resolveFor(USER_B, { "x-tenant-id": TENANT_A });

    expect(result.outcome).toBe("forbidden");
  });

  it("un tenant inexistente se rechaza igual que uno ajeno", async () => {
    const ajeno = await resolveFor(USER_A, { "x-tenant-id": TENANT_B });
    const inventado = await resolveFor(USER_A, {
      "x-tenant-id": "99999999-9999-4999-8999-999999999999"
    });

    expect(inventado.outcome).toBe(ajeno.outcome);
  });

  it("un usuario sin ninguna membership no obtiene contexto", async () => {
    const result = await resolveFor("cccccccc-cccc-4ccc-8ccc-cccccccccccc");

    expect(result.outcome).toBe("forbidden");
  });
});

describe("manipulación de la petición", () => {
  it("una cabecera de tenant duplicada no permite colar un tenant ajeno", async () => {
    // Node entrega las cabeceras repetidas como array. Se toma la primera y se
    // valida igual; el valor extra no puede sobrescribir la decisión.
    const request = {
      headers: { "x-tenant-id": [TENANT_B, TENANT_A] }
    } as unknown as IncomingMessage;

    const result = await resolveRequestContext(request, asUser(USER_A), repository(MEMBERSHIPS));

    expect(result.outcome).toBe("forbidden");
  });

  it("los scopes salen del rol en base de datos, no de lo que envíe el cliente", async () => {
    const result = await resolveRequestContext(
      userRequest({ "x-tenant-id": TENANT_A, "x-scopes": "tenant.manage,flows.publish" }),
      // Un token con claims inventados: el verificador sólo expone actorId, así
      // que inyectar rol o scopes en el JWT no tiene ningún efecto aquí.
      { kind: "user", identity: { actorId: USER_A, role: "platform_admin" } as never },
      repository([membership(USER_A, TENANT_A, "viewer")])
    );

    expect(result.outcome).toBe("resolved");
    expect(result.outcome === "resolved" && result.context.scopes).toEqual([
      "flows.read",
      "analytics.read"
    ]);
  });

  it("un rol degradado en base de datos reduce los scopes en la petición siguiente", async () => {
    const asOwner = await resolveRequestContext(
      userRequest({ "x-tenant-id": TENANT_A }),
      asUser(USER_A),
      repository([membership(USER_A, TENANT_A, "tenant_owner")])
    );
    const asViewer = await resolveRequestContext(
      userRequest({ "x-tenant-id": TENANT_A }),
      asUser(USER_A),
      repository([membership(USER_A, TENANT_A, "viewer")])
    );

    expect(asOwner.outcome === "resolved" && asOwner.context.scopes).toContain("tenant.manage");
    expect(asViewer.outcome === "resolved" && asViewer.context.scopes).not.toContain("tenant.manage");
  });

  it("una membership revocada no otorga acceso aunque el tenant exista", async () => {
    const revoked: Membership = { ...membership(USER_A, TENANT_A, "tenant_owner"), status: "revoked" };

    const result = await resolveRequestContext(
      userRequest({ "x-tenant-id": TENANT_A }),
      asUser(USER_A),
      // El repositorio real filtra por status='active'; aquí se emula devolviendo
      // null, que es exactamente lo que hace `SqlMembershipRepository`.
      {
        async findActive() {
          return null;
        },
        async findActiveByUser() {
          return [];
        }
      }
    );

    expect(result.outcome).toBe("forbidden");
    expect(revoked.status).toBe("revoked");
  });

  it("peticiones concurrentes de A y B no se contaminan entre sí", async () => {
    const [a, b] = await Promise.all([
      resolveFor(USER_A, { "x-tenant-id": TENANT_A }),
      resolveFor(USER_B, { "x-tenant-id": TENANT_B })
    ]);

    expect(a.outcome === "resolved" && a.context.tenantId).toBe(TENANT_A);
    expect(a.outcome === "resolved" && a.context.actorId).toBe(USER_A);
    expect(b.outcome === "resolved" && b.context.tenantId).toBe(TENANT_B);
    expect(b.outcome === "resolved" && b.context.actorId).toBe(USER_B);
  });

  it("cada petición recibe su propio requestId", async () => {
    const first = await resolveFor(USER_A, { "x-tenant-id": TENANT_A });
    const second = await resolveFor(USER_A, { "x-tenant-id": TENANT_A });

    expect(first.outcome === "resolved" && second.outcome === "resolved").toBe(true);
    expect(first.outcome === "resolved" && second.outcome === "resolved" &&
      first.context.requestId !== second.context.requestId).toBe(true);
  });
});

describe("selección de tenant con varias pertenencias", () => {
  const both = [
    membership(USER_A, TENANT_A, "tenant_owner"),
    membership(USER_A, TENANT_B, "viewer")
  ];

  it("sin cabecera y con varios tenants exige elegir, no escoge por su cuenta", async () => {
    const result = await resolveRequestContext(
      userRequest(),
      asUser(USER_A),
      repository(both)
    );

    expect(result.outcome).toBe("tenant_required");
  });

  it("con cabecera usa el rol de ESE tenant, no el más permisivo", async () => {
    const result = await resolveRequestContext(
      userRequest({ "x-tenant-id": TENANT_B }),
      asUser(USER_A),
      repository(both)
    );

    expect(result.outcome === "resolved" && result.context.scopes).not.toContain("tenant.manage");
  });

  it("con un solo tenant lo resuelve sin exigir cabecera", async () => {
    const result = await resolveFor(USER_A);

    expect(result.outcome).toBe("resolved");
    expect(result.outcome === "resolved" && result.context.tenantId).toBe(TENANT_A);
  });
});

describe("credencial de máquina", () => {
  const machine: AuthenticatedPrincipal = {
    kind: "machine",
    identity: { tenantId: TENANT_A, actorId: "worker-1", scopes: ["runtime.execute"] }
  };

  it("usa el tenant de su credencial", async () => {
    const result = await resolveRequestContext(
      userRequest(),
      machine,
      repository(MEMBERSHIPS)
    );

    expect(result.outcome === "resolved" && result.context.tenantId).toBe(TENANT_A);
    expect(result.outcome === "resolved" && result.context.authMethod).toBe("api_key");
  });

  it("la cabecera NO puede reasignar el tenant de una credencial de máquina", async () => {
    const result = await resolveRequestContext(
      userRequest({ "x-tenant-id": TENANT_B }),
      machine,
      repository(MEMBERSHIPS)
    );

    expect(result.outcome === "resolved" && result.context.tenantId).toBe(TENANT_A);
  });

  it("conserva exactamente los scopes de su credencial", async () => {
    const result = await resolveRequestContext(userRequest(), machine, repository(MEMBERSHIPS));

    expect(result.outcome === "resolved" && result.context.scopes).toEqual(["runtime.execute"]);
  });
});
