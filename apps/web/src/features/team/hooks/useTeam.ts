import { useCallback, useEffect, useState } from "react";
import type { InvitationLinkResponse, TeamResponse, TeamRole } from "@contracts/TeamContracts";
import { RequestError } from "@shared/http/RequestError";
import { teamApi } from "../services/teamApi";

export type TeamStatus = "loading" | "ready" | "forbidden" | "error";

/**
 * El equipo de la cuenta activa y sus acciones. Después de cada acción se
 * vuelve a pedir la lista: el servidor manda (roles, invitaciones, permisos).
 */
export function useTeam() {
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [status, setStatus] = useState<TeamStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      setTeam(await teamApi.get());
      setStatus("ready");
    } catch (error) {
      setStatus(error instanceof RequestError && error.status === 403 ? "forbidden" : "error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const after = useCallback(
    async <T,>(action: Promise<T>): Promise<T> => {
      const value = await action;
      await refresh();
      return value;
    },
    [refresh]
  );

  return {
    team,
    status,
    refresh,
    invite: (email: string, role: TeamRole): Promise<InvitationLinkResponse> => after(teamApi.invite({ email, role })),
    renew: (invitationId: string): Promise<InvitationLinkResponse> => after(teamApi.renew(invitationId)),
    revoke: (invitationId: string) => after(teamApi.revoke(invitationId)),
    changeRole: (userId: string, role: TeamRole) => after(teamApi.changeRole(userId, role)),
    remove: (userId: string) => after(teamApi.remove(userId))
  };
}

export type TeamState = ReturnType<typeof useTeam>;
