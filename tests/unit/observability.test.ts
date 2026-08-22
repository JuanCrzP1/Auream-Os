import { describe, it, expect, vi, beforeEach } from "vitest";
import { StructuredLogger } from "../../platform/observability/logging/StructuredLogger.js";
import { AuditLogger } from "../../platform/observability/audit/AuditLogger.js";
import { InMemoryAuditEventStore } from "../../infrastructure/persistence/memory/InMemoryAuditEventStore.js";
import { DomainError } from "../../platform/observability/errors/DomainError.js";
import { RuntimeError } from "../../platform/observability/errors/RuntimeError.js";
import { BillingError } from "../../platform/observability/errors/BillingError.js";
import { ValidationError } from "../../platform/observability/errors/ValidationError.js";
import { PublishError } from "../../platform/observability/errors/PublishError.js";

describe("StructuredLogger", () => {
  let lines: string[];

  beforeEach(() => {
    lines = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
  });

  it("escribe JSON válido a stdout en nivel info", () => {
    const logger = new StructuredLogger({ service: "test" });
    logger.info("mensaje de prueba", { key: "valor" });
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]!);
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("mensaje de prueba");
    expect(entry.key).toBe("valor");
    expect(entry.service).toBe("test");
    expect(entry.timestamp).toBeDefined();
  });

  it("withContext hereda contexto base y permite sobrescritura", () => {
    const base = new StructuredLogger({ service: "test", env: "dev" });
    const child = base.withContext({ requestId: "abc" });
    child.warn("alerta", { extra: 1 });
    const entry = JSON.parse(lines[0]!);
    expect(entry.level).toBe("warn");
    expect(entry.service).toBe("test");
    expect(entry.env).toBe("dev");
    expect(entry.requestId).toBe("abc");
    expect(entry.extra).toBe(1);
  });

  it("error escribe nivel error", () => {
    const logger = new StructuredLogger();
    logger.error("fallo grave");
    const entry = JSON.parse(lines[0]!);
    expect(entry.level).toBe("error");
  });
});

describe("DomainError hierarchy", () => {
  it("RuntimeError tiene statusCode 500 y code RUNTIME_ERROR", () => {
    const err = new RuntimeError("fallo interno");
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("RUNTIME_ERROR");
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(Error);
  });

  it("BillingError tiene statusCode 402 y code BILLING_ERROR", () => {
    const err = new BillingError("pago requerido");
    expect(err.statusCode).toBe(402);
    expect(err.code).toBe("BILLING_ERROR");
    expect(err).toBeInstanceOf(DomainError);
  });

  it("ValidationError tiene statusCode 422 y code VALIDATION_ERROR", () => {
    const err = new ValidationError("campo inválido");
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe("VALIDATION_ERROR");
  });

  it("PublishError tiene statusCode 409 y code PUBLISH_ERROR", () => {
    const err = new PublishError("conflicto al publicar");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("PUBLISH_ERROR");
  });
});

describe("AuditLogger + InMemoryAuditEventStore", () => {
  it("registra eventos con type, tenantId, actorId", () => {
    const store = new InMemoryAuditEventStore();
    const auditLogger = new AuditLogger(store);

    auditLogger.recordPublish("tenant-a", "actor-1", "req-1", "flow-x");
    const events = store.findByTenant("tenant-a");

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("flow.published");
    expect(events[0]!.tenantId).toBe("tenant-a");
    expect(events[0]!.actorId).toBe("actor-1");
    expect(events[0]!.id).toBeDefined();
    expect(events[0]!.timestamp).toBeDefined();
  });

  it("aísla eventos entre tenants", () => {
    const store = new InMemoryAuditEventStore();
    const auditLogger = new AuditLogger(store);

    auditLogger.recordPublish("tenant-a", "actor-1", "req-1", "flow-x");
    auditLogger.recordPublish("tenant-b", "actor-2", "req-2", "flow-y");

    expect(store.findByTenant("tenant-a")).toHaveLength(1);
    expect(store.findByTenant("tenant-b")).toHaveLength(1);
    expect(store.findByTenant("tenant-a")[0]!.tenantId).toBe("tenant-a");
  });

  it("findByType filtra correctamente", () => {
    const store = new InMemoryAuditEventStore();
    const auditLogger = new AuditLogger(store);

    auditLogger.recordPublish("tenant-a", "actor-1", "req-1", "flow-x");
    auditLogger.recordRollback("tenant-a", "actor-1", "req-2", "flow-x");
    auditLogger.recordAuthFailed("tenant-a", "actor-1", "req-3", "token inválido");

    const published = store.findByType("tenant-a", "flow.published");
    expect(published).toHaveLength(1);
    expect(published[0]!.type).toBe("flow.published");
  });

  it("findByTenant respeta el límite", () => {
    const store = new InMemoryAuditEventStore();
    const auditLogger = new AuditLogger(store);

    for (let i = 0; i < 10; i++) {
      auditLogger.recordPublish("tenant-a", "actor-1", `req-${i}`, "flow-x");
    }

    const limited = store.findByTenant("tenant-a", 3);
    expect(limited).toHaveLength(3);
  });
});
