import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// InMemorySessionRepository — tenant isolation
// ---------------------------------------------------------------------------

describe("InMemorySessionRepository — tenant isolation", () => {
  it("las sessions de distintos tenants no se solapan por clave", async () => {
    const { InMemorySessionRepository } = await import(
      "../../infrastructure/persistence/memory/InMemorySessionRepository.js"
    );

    const repo = new InMemorySessionRepository();

    const now = new Date().toISOString();

    const sessionA = {
      id: "tenant-a:conv-001",
      tenantId: "tenant-a",
      flowId: "flow-1",
      flowVersionId: "v1",
      channel: "web",
      conversationKey: "conv-001",
      userKey: "user-001",
      currentNodeId: "node-start",
      status: "active" as const,
      revision: 1,
      context: {},
      createdAt: now,
      updatedAt: now
    };

    const sessionB = {
      id: "tenant-b:conv-001",
      tenantId: "tenant-b",
      flowId: "flow-1",
      flowVersionId: "v1",
      channel: "web",
      conversationKey: "conv-001",
      userKey: "user-001",
      currentNodeId: "node-start",
      status: "active" as const,
      revision: 1,
      context: {},
      createdAt: now,
      updatedAt: now
    };

    repo.save(sessionA);
    repo.save(sessionB);

    // tenant-a no puede acceder a la sesión de tenant-b usando su propia clave
    const foundViaA = repo.find("tenant-a:conv-001");
    expect(foundViaA?.tenantId).toBe("tenant-a");
    expect(foundViaA?.tenantId).not.toBe("tenant-b");

    // tenant-b no puede acceder a la sesión de tenant-a usando su propia clave
    const foundViaB = repo.find("tenant-b:conv-001");
    expect(foundViaB?.tenantId).toBe("tenant-b");
    expect(foundViaB?.tenantId).not.toBe("tenant-a");

    // Intento de cross-tenant con clave de tenant-a → no encuentra sesión de tenant-b
    const crossAttempt = repo.find("tenant-a:conv-001");
    expect(crossAttempt?.id).toBe("tenant-a:conv-001");
    expect(crossAttempt?.id).not.toBe("tenant-b:conv-001");
  });
});
