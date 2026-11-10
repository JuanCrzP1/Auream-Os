import type { TeamRole } from "@contracts/TeamContracts";

// ---------------------------------------------------------------------------
// Los roles del equipo tal como los ve el cliente. Una sola fuente para el
// menú de la cuenta, Configuración → Equipo y la página de invitación.
// Las reglas (quién puede tocar a quién) viven en el servidor.
// ---------------------------------------------------------------------------

export type TeamRoleTone = "owner" | "admin" | "agent" | "viewer";

export interface TeamRoleInfo {
  readonly label: string;
  /** Qué puede hacer, en una frase. */
  readonly description: string;
  /** Color de su chip. */
  readonly tone: TeamRoleTone;
}

export const TEAM_ROLE_INFO: Readonly<Record<TeamRole, TeamRoleInfo>> = {
  tenant_owner: { label: "Dueño", description: "Todo, incluidos los datos de la empresa y nombrar a otros dueños.", tone: "owner" },
  tenant_admin: { label: "Administrador", description: "Todo menos los datos de la empresa. Administra el equipo, salvo a los dueños.", tone: "admin" },
  operator: { label: "Asesor", description: "Atiende conversaciones y contactos. Ve las automatizaciones sin editarlas.", tone: "agent" },
  viewer: { label: "Solo lectura", description: "Ve todo y no cambia nada.", tone: "viewer" }
};

/** Nombre de cualquier rol, también los que no son de un equipo. */
export function roleLabel(role: string): string {
  if (role === "platform_admin") return "Administrador de la plataforma";
  return role in TEAM_ROLE_INFO ? TEAM_ROLE_INFO[role as TeamRole].label : role;
}
