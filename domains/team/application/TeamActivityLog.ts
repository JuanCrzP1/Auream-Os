import type { TeamActivityAction, TeamRole } from "../../../contracts/TeamContracts";

// ---------------------------------------------------------------------------
// TeamActivityLog — puerto. El registro de lo que pasa en el equipo: quién
// invitó, renovó o retiró una invitación, quién entró, quién cambió un rol o
// quitó a alguien. Implementación SQL: `SqlTeamActivityLog` (`team_activity`).
// Un fallo al anotar nunca deshace la acción: lo decide quien la llama.
// ---------------------------------------------------------------------------

export interface TeamActivityEntry {
  readonly tenantId: string;
  readonly actorId: string;
  readonly action: TeamActivityAction;
  readonly targetUserId?: string;
  readonly targetEmail?: string;
  readonly role?: TeamRole;
}

export interface TeamActivityRecord {
  readonly id: string;
  readonly action: TeamActivityAction;
  /** Nombre (o correo) de quien lo hizo. */
  readonly actorName: string | null;
  /** Nombre o correo de a quién le pasó. */
  readonly targetName: string | null;
  readonly role: TeamRole | null;
  readonly at: string;
}

export interface TeamActivityLog {
  record(entry: TeamActivityEntry): Promise<void>;
  /** Lo más reciente primero. */
  list(tenantId: string, limit: number): Promise<ReadonlyArray<TeamActivityRecord>>;
}
