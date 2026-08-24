#!/usr/bin/env node
// ---------------------------------------------------------------------------
// migrate.mjs
//
// Responsabilidad única: aplicar las migraciones SQL pendientes al destino
// resuelto, registrando nombre, checksum y fecha.
//
//   node scripts/db/migrate.mjs                        -> rama test (por defecto)
//   node scripts/db/migrate.mjs --confirm-production    -> producción (explícito)
//
// Si una migración ya aplicada cambió de contenido, aborta: nunca reaplica ni
// ignora en silencio una migración modificada.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { resolveTargetDatabase, UnsafeTargetError } from "./resolveTargetDatabase.mjs";

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..", "..", "infrastructure", "persistence", "sql", "migrations"
);

function checksumOf(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

function readMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, name), "utf-8");
      return { name, sql, checksum: checksumOf(sql) };
    });
}

async function ensureControlTable(client, migrations) {
  const control = migrations.find((m) => m.name.includes("schema_migrations"));

  if (!control) {
    throw new Error("Falta la migración que crea schema_migrations.");
  }

  await client.query(control.sql);
}

async function applyMigrations(client, migrations) {
  const { rows } = await client.query("select name, checksum from schema_migrations");
  const applied = new Map(rows.map((r) => [r.name, r.checksum]));

  let count = 0;

  for (const migration of migrations) {
    const previous = applied.get(migration.name);

    if (previous !== undefined) {
      if (previous !== migration.checksum) {
        throw new Error(
          `Checksum mismatch en '${migration.name}': la migración cambió después de aplicarse. Abortado.`
        );
      }
      continue;
    }

    await client.query("begin");
    try {
      await client.query(migration.sql);
      await client.query(
        "insert into schema_migrations (name, checksum) values ($1, $2)",
        [migration.name, migration.checksum]
      );
      await client.query("commit");
      console.log(`  aplicada: ${migration.name}`);
      count += 1;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }

  return count;
}

async function main() {
  const allowProduction = process.argv.includes("--confirm-production");
  const { connectionString, target, host } = resolveTargetDatabase({ allowProduction });

  console.log(`Migrando destino: ${target} [${host}]`);

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const migrations = readMigrations();
    await ensureControlTable(client, migrations);
    const count = await applyMigrations(client, migrations);
    console.log(count === 0 ? "Sin migraciones pendientes." : `${count} migración(es) aplicada(s).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  if (error instanceof UnsafeTargetError) {
    console.error(`[ABORTADO] ${error.message}`);
    process.exit(1);
  }
  console.error(`[ERROR] ${error.message}`);
  process.exit(1);
});
