#!/usr/bin/env node
// ---------------------------------------------------------------------------
// seed-dev.mjs
//
// Responsabilidad única: sembrar datos mínimos de desarrollo en la rama test.
//
// TEST-ONLY por construcción: usa el mismo resolvedor que las migraciones y
// nunca acepta `--confirm-production`. No existe camino de código que escriba
// en producción.
// ---------------------------------------------------------------------------

import pg from "pg";
import { resolveTargetDatabase, UnsafeTargetError } from "./resolveTargetDatabase.mjs";

const DEV_TENANT_KEY = "test-tenant";
const DEV_TENANT_NAME = "Espacio de desarrollo";

async function main() {
  if (process.argv.includes("--confirm-production")) {
    throw new UnsafeTargetError("El seed nunca puede ejecutarse contra producción.");
  }

  const { connectionString, target, host } = resolveTargetDatabase({ allowProduction: false });
  console.log(`Sembrando destino: ${target} [${host}]`);

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const result = await client.query(
      `insert into tenants (key, name) values ($1, $2)
       on conflict (key) do update set name = excluded.name
       returning id, key`,
      [DEV_TENANT_KEY, DEV_TENANT_NAME]
    );

    const tenant = result.rows[0];
    console.log(`  tenant listo: ${tenant.key} (${tenant.id})`);
    console.log("  Sin memberships: se crean al registrarse un usuario real.");
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
