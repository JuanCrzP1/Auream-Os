import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

// Neon cierra conexiones que llevan rato quietas. Sin oyente de «error» en el
// grupo, `pg` lo emite y Node tumba la API entera (pasó en local). Ahora se
// avisa y el grupo sigue: la siguiente consulta abre otra conexión.

/** Una conexión falsa: `rollback` falla si se «cortó la red». */
class FakeConnection extends EventEmitter {
  public released: unknown = "no";
  public cut = false;
  public async query(sql: string) {
    if (this.cut) throw new Error("Connection terminated unexpectedly");
    if (sql === "select boom") throw new Error("syntax error");
    return { rows: [], rowCount: 0 };
  }
  public release(error?: unknown) {
    this.released = error ?? null;
  }
}

const pools: Array<EventEmitter & { connection: FakeConnection }> = [];
vi.mock("pg", () => ({
  default: {
    Pool: class extends EventEmitter {
      public connection = new FakeConnection();
      public constructor() {
        super();
        pools.push(this as never);
      }
      public async connect() {
        return this.connection;
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

  it("si la red se corta en plena transacción: avisa, no tumba el proceso, da el error original y descarta la conexión", async () => {
    const { createSqlClient } = await import("../../infrastructure/persistence/sql/SqlClient.js");
    const lost = vi.fn();
    const client = createSqlClient("postgres://ejemplo", { onIdleError: lost });
    const pool = pools.at(-1)!;
    const failure = client.transaction(async () => {
      pool.connection.cut = true;
      const error = new Error("Connection terminated unexpectedly");
      expect(() => pool.connection.emit("error", error)).not.toThrow();
      throw new Error("la consulta se cortó");
    });
    await expect(failure).rejects.toThrow("la consulta se cortó");
    expect(lost).toHaveBeenCalled();
    expect(pool.connection.released).toBeInstanceOf(Error);
    expect(pool.connection.listenerCount("error")).toBe(0);
  });

  it("un error normal de SQL hace rollback y devuelve la conexión sana al grupo", async () => {
    const { createSqlClient } = await import("../../infrastructure/persistence/sql/SqlClient.js");
    const client = createSqlClient("postgres://ejemplo");
    const pool = pools.at(-1)!;
    await expect(client.transaction((tx) => tx.query("select boom"))).rejects.toThrow("syntax error");
    expect(pool.connection.released).toBeNull();
  });
});
