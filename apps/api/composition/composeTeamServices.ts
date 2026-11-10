import { InvitationServices } from "../../../domains/team/application/InvitationServices";
import { TeamServices } from "../../../domains/team/application/TeamServices";
import { SqlInvitationRepository } from "../../../infrastructure/persistence/sql/SqlInvitationRepository";
import { SqlTeamRepository } from "../../../infrastructure/persistence/sql/SqlTeamRepository";
import { SqlTeamActivityLog } from "../../../infrastructure/persistence/sql/SqlTeamActivityLog";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";

// ---------------------------------------------------------------------------
// composeTeamServices — Equipo en Neon: el lado de quien administra
// (`/team`) y el de quien recibe la invitación (`/invitations/:token` y
// `/me/invitations/:token/accept`). Único punto que elige la implementación SQL.
// ---------------------------------------------------------------------------

export interface TeamModule {
  readonly team: TeamServices;
  readonly invitations: InvitationServices;
}

export function composeTeamServices(sql: SqlClient): TeamModule {
  const invitations = new SqlInvitationRepository(sql);
  const log = new SqlTeamActivityLog(sql);
  return {
    team: new TeamServices(new SqlTeamRepository(sql), invitations, log),
    invitations: new InvitationServices(invitations, log)
  };
}
