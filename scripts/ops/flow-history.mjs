#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Historial INTERNO de un chat: los turnos de sus flujos (qué los inició, por
// qué bloques pasaron, qué salió y qué falló, la espera programada y la cola
// de tareas de ese chat). Solo lectura.
//
//   node scripts/ops/flow-history.mjs <últimos dígitos del teléfono> [--limit 30]
//        → rama test (TEST_DATABASE_URL)
//   DATABASE_URL=… node scripts/ops/flow-history.mjs 2233 --confirm-production
//        → producción (explícito; `resolveTargetDatabase` comprueba el host)
// ---------------------------------------------------------------------------

import pg from "pg";
import { resolveTargetDatabase } from "../db/resolveTargetDatabase.mjs";

const args = process.argv.slice(2);
const suffix = args.find((arg) => /^\d{2,15}$/.test(arg));
const limitIndex = args.indexOf("--limit");
const limit = limitIndex >= 0 ? Math.min(200, Number(args[limitIndex + 1]) || 30) : 30;
if (!suffix) {
  console.error("Uso: node scripts/ops/flow-history.mjs <últimos dígitos del teléfono> [--limit 30] [--confirm-production]");
  process.exit(1);
}

const { connectionString, target, host } = resolveTargetDatabase({ allowProduction: args.includes("--confirm-production") });
const client = new pg.Client({ connectionString });
const time = (value) => (value ? new Date(value).toISOString().slice(11, 23) : "-");

try {
  await client.connect();
  await client.query("begin read only");
  console.log(`Historial · ${target} [${host}] · chat …${suffix}\n`);
  const turns = await client.query(
    `select started_at, finished_at, origin, trigger, flow_key, steps, session_node, session_status, sent, failures, wake_up, error, events
       from flow_turn_log where conversation_key like $1 order by started_at desc limit $2`,
    [`%${suffix}`, limit]
  );
  for (const row of turns.rows.reverse()) {
    const steps = row.steps.map((step) => `${step.type}:${step.status}${step.output ? `>${step.output}` : ""}`).join(" → ") || "(sin bloques)";
    const ms = new Date(row.finished_at) - new Date(row.started_at);
    console.log(`${time(row.started_at)} ${row.origin.padEnd(7)} ${row.flow_key} · ${steps} · ${ms} ms`);
    console.log(`             enviados ${row.sent}${row.failures.length ? ` · fallos: ${row.failures.join(" | ")}` : ""} · queda ${row.session_status ?? "-"}@${row.session_node ?? "-"}${row.wake_up ? ` · espera ${row.wake_up.reason} a las ${time(row.wake_up.at)}` : ""}${row.error ? ` · ERROR: ${row.error}` : ""}`);
    if (row.origin === "timer") console.log(`             despertador ${row.trigger}`);
    const notable = row.events.filter((event) => /stale|ignored|skipped|failed|not_connected|exceeded/.test(event));
    if (notable.length) console.log(`             eventos: ${notable.join(", ")}`);
  }
  const tasks = await client.query(
    `select kind, status, due_at, finished_at, attempts, last_error from scheduled_tasks
      where group_key like $1 order by due_at desc limit 10`,
    [`%${suffix}`]
  );
  if (tasks.rows.length) {
    console.log("\nCola de tareas del chat (despertadores):");
    for (const task of tasks.rows.reverse()) {
      const late = task.finished_at ? ` (corrió ${Math.round((new Date(task.finished_at) - new Date(task.due_at)) / 1000)} s después)` : "";
      console.log(`  vence ${time(task.due_at)} · ${task.status}${late}${task.attempts > 1 ? ` · intentos ${task.attempts}` : ""}${task.last_error ? ` · ${task.last_error}` : ""}`);
    }
  }
  await client.query("rollback");
} catch (error) {
  console.error(String(error.message).replace(/postgres(ql)?:\/\/\S+/g, "[url]"));
  process.exitCode = 1;
} finally {
  await client.end();
}
