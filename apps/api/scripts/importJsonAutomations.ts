import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type * as NeonEnvironments from "../../../config/neon-environments.mjs";
import { createSqlClient, type SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlAutomationRepository } from "../../../infrastructure/persistence/sql/SqlAutomationRepository";
import { SqlFolderRepository } from "../../../infrastructure/persistence/sql/SqlFolderRepository";
import { SqlBuilderWorkspaceRepository } from "../../../infrastructure/persistence/sql/SqlBuilderWorkspaceRepository";
import { SqlTenantRepository } from "../../../infrastructure/persistence/sql/SqlTenantRepository";
import { isUuid } from "../../../infrastructure/persistence/sql/sqlValues";
import { JsonAutomationRepository } from "../../../infrastructure/persistence/json/JsonAutomationRepository";
import { JsonFolderRepository } from "../../../infrastructure/persistence/json/JsonFolderRepository";
import { JsonBuilderWorkspaceRepository } from "../../../infrastructure/persistence/json/JsonBuilderWorkspaceRepository";
import { upgradeWorkspace } from "../../../domains/automations/builder/application/UpgradingBuilderWorkspaceRepository";

// ---------------------------------------------------------------------------
// importJsonAutomations — FASE C2: pasa las automatizaciones guardadas en
// archivos (`DATA_DIR`) a PostgreSQL. Se ejecuta una vez por entorno.
//
//   node --env-file=.env.test dist/apps/api/scripts/importJsonAutomations.js           → test, simulación
//   node --env-file=.env.test dist/apps/api/scripts/importJsonAutomations.js --apply   → test, escribe
//   node --env-file=.env dist/apps/api/scripts/importJsonAutomations.js --confirm-production [--apply]
//
// Reutiliza las piezas de la API, no las reescribe: lee con los repositorios
// de archivos, normaliza con `upgradeWorkspace` (bloque de inicio, sin
// historial de publicación) y escribe con los repositorios SQL, un flujo por
// transacción. Es idempotente: lo que ya existe en la base no se toca.
//
// No se importa: carpetas de cuentas que no son un uuid (`test-tenant`), ni de
// cuentas que no existen en la base, ni borradores sin entrada en el catálogo
// (hoy tampoco se ven en el hub). Todo queda contado en el informe.
// ---------------------------------------------------------------------------

// La identificación de ramas de Neon vive en un único `.mjs` compartido con los
// scripts de base de datos. No se copia a `dist/`, así que se carga desde la
// raíz del proyecto (desde donde se ejecuta el script).
const { isProductionDatabaseUrl, parseDatabaseHost, safeHostOf } = require(
  join(process.cwd(), "config", "neon-environments.mjs")
) as typeof NeonEnvironments;

interface Target {
  readonly connectionString: string;
  readonly name: "test" | "production";
}

function resolveTarget(env: NodeJS.ProcessEnv, confirmProduction: boolean): Target {
  if (confirmProduction) {
    const url = env["DATABASE_URL"];
    if (!url || parseDatabaseHost(url) === null || !isProductionDatabaseUrl(url)) {
      throw new Error("--confirm-production exige DATABASE_URL apuntando a producción. Abortado.");
    }
    return { connectionString: url, name: "production" };
  }
  const url = env["TEST_DATABASE_URL"];
  if (!url || parseDatabaseHost(url) === null) throw new Error("TEST_DATABASE_URL no está definido o no es válido.");
  if (isProductionDatabaseUrl(url)) throw new Error("TEST_DATABASE_URL apunta a producción. Abortado.");
  return { connectionString: url, name: "test" };
}

interface Report {
  tenants: number;
  folders: number;
  automations: number;
  drafts: number;
  alreadyThere: number;
  skippedTenants: string[];
  orphanDrafts: number;
}

async function importTenant(sql: SqlClient, dataDir: string, tenantId: string, apply: boolean, report: Report): Promise<void> {
  const folders = await new JsonFolderRepository(dataDir).findByTenant(tenantId);
  const flows = await new JsonAutomationRepository(dataDir).findByTenant(tenantId);
  const jsonWorkspaces = new JsonBuilderWorkspaceRepository(dataDir);
  const folderIds = new Set(folders.map((folder) => folder.id));

  const sqlFolders = new SqlFolderRepository(sql);
  for (const folder of folders) {
    if (await sqlFolders.findById(tenantId, folder.id)) {
      report.alreadyThere += 1;
      continue;
    }
    if (apply) await sqlFolders.save(folder);
    report.folders += 1;
  }

  const catalogKeys = new Set<string>();
  for (const flow of flows) {
    catalogKeys.add(flow.key);
    if (!isUuid(flow.id)) continue;
    if (await new SqlAutomationRepository(sql).findById(tenantId, flow.id)) {
      report.alreadyThere += 1;
      continue;
    }

    // Una carpeta que ya no existe no puede referenciarse: la automatización va a la raíz.
    const { folderId, ...rest } = flow;
    const entry = folderId !== undefined && folderIds.has(folderId) ? flow : rest;
    const stored = await jsonWorkspaces.getWorkspace(tenantId, flow.key);
    const workspace = stored ? upgradeWorkspace(stored) : null;

    if (apply) {
      await sql.transaction(async (tx) => {
        await new SqlAutomationRepository(tx).save(entry);
        if (workspace) await new SqlBuilderWorkspaceRepository(tx).saveWorkspace(workspace);
      });
    }
    report.automations += 1;
    if (workspace) report.drafts += 1;
  }

  const files = await readdir(join(dataDir, tenantId)).catch(() => [] as string[]);
  report.orphanDrafts += files.filter((file) => file.endsWith(".json") && !catalogKeys.has(file.slice(0, -5))).length;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const target = resolveTarget(process.env, args.includes("--confirm-production"));
  const dataDir = process.env["DATA_DIR"] ?? join(process.cwd(), "data", "builder-workspaces");

  console.log(`Destino: ${target.name} [${safeHostOf(target.connectionString)}] · origen: ${dataDir}`);
  console.log(apply ? "Modo: ESCRIBE" : "Modo: simulación (añade --apply para escribir)");

  const sql = createSqlClient(target.connectionString);
  const tenants = new SqlTenantRepository(sql);
  const report: Report = { tenants: 0, folders: 0, automations: 0, drafts: 0, alreadyThere: 0, skippedTenants: [], orphanDrafts: 0 };

  try {
    const dirs = await readdir(dataDir, { withFileTypes: true });
    for (const dir of dirs.filter((entry) => entry.isDirectory())) {
      const tenantId = dir.name;
      if (!isUuid(tenantId) || !(await tenants.findById(tenantId))) {
        report.skippedTenants.push(tenantId);
        continue;
      }
      report.tenants += 1;
      await importTenant(sql, dataDir, tenantId, apply, report);
    }
  } finally {
    await sql.close();
  }

  const verb = apply ? "importadas" : "a importar";
  console.log(`Cuentas: ${report.tenants} · carpetas ${verb}: ${report.folders} · automatizaciones ${verb}: ${report.automations} (con borrador: ${report.drafts})`);
  console.log(`Ya existían (no se tocan): ${report.alreadyThere} · borradores sin catálogo (no se importan): ${report.orphanDrafts}`);
  if (report.skippedTenants.length > 0) {
    console.log(`Carpetas de cuenta omitidas (no son una cuenta de esta base): ${report.skippedTenants.join(", ")}`);
  }
}

main().catch((error: unknown) => {
  console.error(`[importJsonAutomations] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
