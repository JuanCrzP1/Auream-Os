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

export function createSqlClient(connectionString: string): SqlClient {
  const pool = new pg.Pool({ connectionString });

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

      try {
        await connection.query("begin");
        const result = await work({
          query: (sql, params) => runQuery(connection, sql, params)
        });
        await connection.query("commit");
        return result;
      } catch (error) {
        await connection.query("rollback");
        throw error;
      } finally {
        connection.release();
      }
    },

    close: () => pool.end()
  };
}
