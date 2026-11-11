import type { OnboardingStep } from "../../../contracts/HelpContracts";
import type { OnboardingProbe } from "../../../domains/help/application/HelpPorts";
import type { SqlClient } from "./SqlClient";

// «Empieza aquí»: qué ya hizo la cuenta, leído de sus propios datos (cada
// paso se marca solo, nadie lo marca a mano). Una sola consulta.

const STEPS: ReadonlyArray<Omit<OnboardingStep, "done">> = [
  { id: "number", title: "Conecta tu número de WhatsApp", detail: "Con el código QR, en 1 minuto", path: "/connections" },
  { id: "flow", title: "Crea tu primer flujo", detail: "Una bienvenida que responde sola", path: "/automations" },
  { id: "products", title: "Agrega tus productos y precios", detail: "Por país, para registrar ventas", path: "/sales?tab=products" },
  { id: "team", title: "Invita a tu equipo", detail: "Cada asesor con su rol", path: "/settings/team" },
  { id: "meta", title: "Conecta Meta Ads", detail: "Para ver el ROAS real", path: "/meta-ads?tab=accounts" },
  { id: "broadcast", title: "Envía tu primera difusión", detail: "A quien ya te escribió", path: "/broadcasts" }
];

export class SqlOnboardingProbe implements OnboardingProbe {
  public constructor(private readonly sql: SqlClient) {}

  public async steps(tenantId: string): Promise<ReadonlyArray<OnboardingStep>> {
    const result = await this.sql.query<Record<OnboardingStep["id"], boolean>>(
      `select
         exists (select 1 from whatsapp_connections where tenant_id = $1 and deleted_at is null and status = 'connected') as number,
         exists (select 1 from automations where tenant_id = $1) as flow,
         exists (select 1 from products where tenant_id = $1) as products,
         (select count(*) from memberships where tenant_id = $1) > 1 as team,
         exists (select 1 from meta_connections where tenant_id = $1) as meta,
         exists (select 1 from broadcasts where tenant_id = $1) as broadcast`,
      [tenantId]
    );
    const row = result.rows[0];
    return STEPS.map((step) => ({ ...step, done: Boolean(row?.[step.id]) }));
  }
}
