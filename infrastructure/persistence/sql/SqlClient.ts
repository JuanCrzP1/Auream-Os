import pg from "pg";

// ---------------------------------------------------------------------------
// SqlClient
//
// Responsabilidad única: ser el ÚNICO punto del backend que conoce el driver
// de PostgreSQL. Todo repositorio SQL recibe esta interfaz, nunca `pg`.
//
// Gracias a eso, cambiar de driver o de proveedor toca este archivo y ninguno
// más — y ningún dominio puede importar `pg` ni una connection string.
// ---------------------------------------------------------------------------

export interface SqlQueryResult<TRow> {
  readonly rows: TRow[];
  readonly rowCount: number;
}

export interface SqlExecutor {
  query<TRow>(sql: string, params?: ReadonlyArray<unknown>): Promise<SqlQueryResult<TRow>>;
}

export interface SqlClient extends SqlExecutor {
  /**
   * Ejecuta `work` dentro de una transacción. Hace commit si termina bien y
   * rollback ante cualquier error, propagándolo.
   */
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface SqlPoolOptions {
  readonly max?: number;
  readonly idleTimeoutMs?: number;
  /** Una conexión se cayó (quieta en el grupo o en plena transacción; p. ej. Neon la cerró o se fue la red): se avisa, no se tumba el proceso. */
  readonly onIdleError?: (error: Error) => void;
}

export function createSqlClient(connectionString: string, options: SqlPoolOptions = {}): SqlClient {
  const pool = new pg.Pool({
    connectionString,
    ...(options.max !== undefined ? { max: options.max } : {}),
    ...(options.idleTimeoutMs !== undefined ? { idleTimeoutMillis: options.idleTimeoutMs } : {})
  });

  // Sin este oyente, cuando el servidor corta una conexión que estaba quieta en
  // el grupo, `pg` emite «error» y Node tumba el proceso entero. El grupo ya
  // descarta esa conexión y abre otra en la siguiente consulta: basta con avisar.
  pool.on("error", (error) => options.onIdleError?.(error));

  const runQuery = async <TRow>(
    executor: { query: (sql: string, params?: ReadonlyArray<unknown>) => Promise<{ rows: TRow[]; rowCount: number | null }> },
    sql: string,
    params?: ReadonlyArray<unknown>
  ): Promise<SqlQueryResult<TRow>> => {
    const result = await executor.query(sql, params);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  };

  return {
    query: (sql, params) => runQuery(pool, sql, params),

    async transaction(work) {
      const connection = await pool.connect();
      // Una conexión EN USO no tiene el oyente del grupo: si la red se corta en
      // plena transacción, `pg` emite «error» en ella y Node tumbaba el proceso
      // (pasó en local al perder la red con Neon). Se avisa y la consulta en
      // curso falla con su propio error, como cualquier otro.
      const onError = (error: Error) => options.onIdleError?.(error);
      connection.on("error", onError);
      let broken: Error | undefined;

      try {
        await connection.query("begin");
        const result = await work({
          query: (sql, params) => runQuery(connection, sql, params)
        });
        await connection.query("commit");
        return result;
      } catch (error) {
        // Si ni el «rollback» pasa, la conexión está rota: se reporta el error
        // ORIGINAL (no el del rollback) y la conexión se descarta.
        await connection.query("rollback").catch((rollbackError: unknown) => {
          broken = rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
        });
        throw error;
      } finally {
        connection.off("error", onError);
        // `release(error)` destruye la conexión en vez de devolverla rota al grupo.
        connection.release(broken);
      }
    },

    close: () => pool.end()
  };
}
