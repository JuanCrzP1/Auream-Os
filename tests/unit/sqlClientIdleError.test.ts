import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

// Neon cierra conexiones que llevan rato quietas. Sin oyente de «error» en el
// grupo, `pg` lo emite y Node tumba la API entera (pasó en local). Ahora se
// avisa y el grupo sigue: la siguiente consulta abre otra conexión.

const pools: EventEmitter[] = [];
vi.mock("pg", () => ({
  default: {
    Pool: class extends EventEmitter {
      public constructor() {
        super();
        pools.push(this);
      }
    }
  }
}));

describe("SqlClient", () => {
  it("una conexión inactiva que se cae se avisa y no tumba el proceso", async () => {
    const { createSqlClient } = await import("../../infrastructure/persistence/sql/SqlClient.js");
    const lost = vi.fn();
    createSqlClient("postgres://ejemplo", { onIdleError: lost });
    createSqlClient("postgres://ejemplo");
    const error = new Error("Connection terminated unexpectedly");
    expect(() => pools[0]!.emit("error", error)).not.toThrow();
    expect(lost).toHaveBeenCalledWith(error);
    expect(() => pools[1]!.emit("error", error)).not.toThrow();
  });
});
