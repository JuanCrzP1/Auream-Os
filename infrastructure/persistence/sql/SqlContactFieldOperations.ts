import type { ContactFieldDefinition } from "../../../contracts/ContactFieldContracts";
import type { FieldOperations, MergeWrite, StoredOperation, TidyWrite } from "../../../domains/contact-fields/application/ContactFieldToolPorts";
import type { BlockChange } from "../../../domains/contact-fields/domain/fieldMerge";
import type { SqlClient, SqlExecutor } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// Ordenar valores, unir campos y deshacer, en PostgreSQL. Cada operación es
// UNA transacción: guarda por cliente su dato antes y después
// (`contact_field_operation_values`), lo aplica y cambia las definiciones.
// Deshacer devuelve el dato solo a quien sigue como lo dejó la operación.
// Todo filtra por cuenta.
// ---------------------------------------------------------------------------

interface OperationRow {
  readonly id: string;
  readonly kind: "tidy" | "merge";
  readonly title: string;
  readonly contacts: number;
  readonly keys: string[];
  readonly definitions: StoredOperation["definitions"];
  readonly flows: BlockChange[];
  readonly created_at: Date | string;
  readonly undone_at: Date | string | null;
}

const toOperation = (row: OperationRow): StoredOperation => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  contacts: row.contacts,
  keys: row.keys,
  definitions: { restore: row.definitions?.restore ?? [], remove: row.definitions?.remove ?? [] },
  flows: row.flows ?? [],
  createdAt: toIso(row.created_at),
  undoneAt: row.undone_at ? toIso(row.undone_at) : null
});

const COLUMNS = "id, kind, title, contacts, keys, definitions, flows, created_at, undone_at";

/** Deja en cada cliente lo que la operación guardó como «después» y devuelve cuántos cambió. */
async function applyAfter(tx: SqlExecutor, tenantId: string, operationId: string, keys: ReadonlyArray<string>): Promise<number> {
  const { rowCount } = await tx.query(
    `update contacts c set custom_fields = (c.custom_fields - $3::text[]) || v.after, updated_at = now()
       from contact_field_operation_values v
      where v.operation_id = $2 and v.contact_id = c.id and c.tenant_id = $1`,
    [tenantId, operationId, [...keys]]
  );
  await tx.query(`update contact_field_operations set contacts = $3 where tenant_id = $1 and id = $2`, [tenantId, operationId, rowCount]);
  return rowCount;
}

/** Lo que ya no se puede deshacer no se guarda para siempre (una fila por cliente): se limpia al hacer la siguiente operación. */
const KEEP_DAYS = 30;

async function insertOperation(tx: SqlExecutor, tenantId: string, write: { operationId: string; title: string; actorId: string }, kind: string, keys: ReadonlyArray<string>, definitions: StoredOperation["definitions"]): Promise<void> {
  await tx.query(`delete from contact_field_operations where tenant_id = $1 and created_at < now() - make_interval(days => $2)`, [tenantId, KEEP_DAYS]);
  await tx.query(
    `insert into contact_field_operations (id, tenant_id, kind, title, keys, definitions, created_by) values ($1, $2, $3, $4, $5::text[], $6::jsonb, $7)`,
    [write.operationId, tenantId, kind, write.title, [...keys], JSON.stringify(definitions), write.actorId]
  );
}

export class SqlContactFieldOperations implements FieldOperations {
  public constructor(private readonly sql: SqlClient) {}

  public async tidy(tenantId: string, write: TidyWrite): Promise<number> {
    const key = write.previous.key;
    return this.sql.transaction(async (tx) => {
      await insertOperation(tx, tenantId, write, "tidy", [key], { restore: [write.previous], remove: [] });
      await tx.query(
        `insert into contact_field_operation_values (operation_id, contact_id, before, after)
         select $3, c.id, jsonb_build_object($2::text, c.custom_fields -> $2::text),
                case when ($4::jsonb -> (c.custom_fields ->> $2::text)) = 'null'::jsonb then '{}'::jsonb
                     else jsonb_build_object($2::text, $4::jsonb -> (c.custom_fields ->> $2::text)) end
           from contacts c
          where c.tenant_id = $1 and c.custom_fields ? $2::text and $4::jsonb ? (c.custom_fields ->> $2::text)`,
        [tenantId, key, write.operationId, JSON.stringify(write.map)]
      );
      await tx.query(`update contact_field_definitions set type = $3, options = $4::jsonb, updated_at = now() where tenant_id = $1 and id = $2`, [
        tenantId,
        write.previous.id,
        write.next.type,
        JSON.stringify(write.next.options)
      ]);
      return applyAfter(tx, tenantId, write.operationId, [key]);
    });
  }

  public async merge(tenantId: string, write: MergeWrite): Promise<number> {
    const keys = [write.keep, ...write.merge];
    return this.sql.transaction(async (tx) => {
      await insertOperation(tx, tenantId, write, "merge", keys, { restore: write.merged, remove: write.createKeep ? [write.createKeep.id] : [] });
      // Gana el dato más reciente (por su origen); sin fecha, el de la clave que queda y luego el orden dado.
      await tx.query(
        `with keys as (select key, ord from unnest($2::text[]) with ordinality as k(key, ord)),
         candidates as (
           select c.id, c.custom_fields -> k.key as value, coalesce(o.updated_at, to_timestamp(0)) as at, k.ord
             from contacts c join keys k on c.custom_fields ? k.key
             left join contact_field_origins o on o.contact_id = c.id and o.key = k.key
            where c.tenant_id = $1 and coalesce(c.custom_fields ->> k.key, '') <> ''
         ), winner as (select distinct on (id) id, value from candidates order by id, at desc, ord),
         touched as (
           select c.id, (select jsonb_object_agg(k.key, c.custom_fields -> k.key) from keys k where c.custom_fields ? k.key) as before,
                  jsonb_build_object($4::text, w.value) as after
             from contacts c join winner w on w.id = c.id where c.tenant_id = $1
         )
         insert into contact_field_operation_values (operation_id, contact_id, before, after)
         select $3, id, before, after from touched where before <> after`,
        [tenantId, keys, write.operationId, write.keep]
      );
      // El origen del dato que ganó pasa a la clave que queda.
      await tx.query(
        `insert into contact_field_origins (tenant_id, contact_id, key, source, flow_key, actor_id, updated_at)
         select distinct on (o.contact_id) o.tenant_id, o.contact_id, $3, o.source, o.flow_key, o.actor_id, o.updated_at
           from contact_field_origins o join contact_field_operation_values v on v.operation_id = $2 and v.contact_id = o.contact_id
          where o.tenant_id = $1 and o.key = any($4::text[]) and v.before -> o.key = v.after -> $3::text
          order by o.contact_id, o.updated_at desc
         on conflict (contact_id, key) do update set source = excluded.source, flow_key = excluded.flow_key, actor_id = excluded.actor_id, updated_at = excluded.updated_at
           where excluded.updated_at >= contact_field_origins.updated_at`,
        [tenantId, write.operationId, write.keep, [...write.merge]]
      );
      const changed = await applyAfter(tx, tenantId, write.operationId, keys);
      await tx.query(`delete from contact_field_definitions where tenant_id = $1 and id = any($2::uuid[])`, [tenantId, write.merged.map((definition) => definition.id)]);
      if (write.createKeep) {
        const { id, shape } = write.createKeep;
        await tx.query(
          `insert into contact_field_definitions (id, tenant_id, key, label, type, options) values ($1, $2, $3, $4, $5, $6::jsonb) on conflict (tenant_id, key) do nothing`,
          [id, tenantId, shape.key, shape.label, shape.type, JSON.stringify(shape.options)]
        );
      }
      return changed;
    });
  }

  public async attachFlows(tenantId: string, operationId: string, flows: ReadonlyArray<BlockChange>): Promise<void> {
    await this.sql.query(`update contact_field_operations set flows = $3::jsonb where tenant_id = $1 and id = $2`, [tenantId, operationId, JSON.stringify(flows)]);
  }

  public async recent(tenantId: string, since: Date): Promise<ReadonlyArray<StoredOperation>> {
    const { rows } = await this.sql.query<OperationRow>(
      `select ${COLUMNS} from contact_field_operations where tenant_id = $1 and created_at >= $2 and undone_at is null order by created_at desc limit 10`,
      [tenantId, since]
    );
    return rows.map(toOperation);
  }

  public async find(tenantId: string, operationId: string): Promise<StoredOperation | null> {
    if (!isUuid(operationId)) return null;
    const { rows } = await this.sql.query<OperationRow>(`select ${COLUMNS} from contact_field_operations where tenant_id = $1 and id = $2`, [tenantId, operationId]);
    return rows[0] ? toOperation(rows[0]) : null;
  }

  public async undo(tenantId: string, operation: StoredOperation): Promise<number | null> {
    return this.sql.transaction(async (tx) => {
      const marked = await tx.query(`update contact_field_operations set undone_at = now() where tenant_id = $1 and id = $2 and undone_at is null`, [tenantId, operation.id]);
      if (marked.rowCount === 0) return null;
      // Solo a quien sigue como lo dejó la operación: lo que cambió después no se pisa.
      const restored = await tx.query(
        `update contacts c set custom_fields = (c.custom_fields - $3::text[]) || v.before, updated_at = now()
           from contact_field_operation_values v
          where v.operation_id = $2 and v.contact_id = c.id and c.tenant_id = $1
            and coalesce((select jsonb_object_agg(k, c.custom_fields -> k) from unnest($3::text[]) k where c.custom_fields ? k), '{}'::jsonb) = v.after`,
        [tenantId, operation.id, [...operation.keys]]
      );
      await tx.query(`delete from contact_field_definitions where tenant_id = $1 and id = any($2::uuid[])`, [tenantId, [...operation.definitions.remove]]);
      for (const definition of operation.definitions.restore) await restoreDefinition(tx, tenantId, definition);
      return restored.rowCount;
    });
  }

}

/** La definición vuelve a como estaba; si ya no existe (se borró al unir), se crea de nuevo salvo que su clave esté tomada. */
async function restoreDefinition(tx: SqlExecutor, tenantId: string, definition: ContactFieldDefinition): Promise<void> {
  const options = JSON.stringify(definition.options);
  const updated = await tx.query(`update contact_field_definitions set type = $3, options = $4::jsonb, updated_at = now() where tenant_id = $1 and id = $2`, [tenantId, definition.id, definition.type, options]);
  if (updated.rowCount > 0) return;
  await tx.query(
    `insert into contact_field_definitions (id, tenant_id, key, label, type, options, created_at) values ($1, $2, $3, $4, $5, $6::jsonb, $7) on conflict do nothing`,
    [definition.id, tenantId, definition.key, definition.label, definition.type, options, definition.createdAt]
  );
}
