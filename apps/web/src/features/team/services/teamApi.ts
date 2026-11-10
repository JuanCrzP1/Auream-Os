import type {
  AcceptInvitationResponse,
  CreateInvitationRequest,
  InvitationLinkResponse,
  InvitationPreviewResponse,
  TeamResponse,
  TeamRole
} from "@contracts/TeamContracts";
import { builderApiClient } from "@shared/http/builderApiClient";

// El equipo por HTTP. `/team` es de la cuenta activa (la elige el servidor
// por `X-Tenant-Id` y la membresía); `/invitations/:token` se abre sin sesión
// y `/me/invitations/:token/accept` se acepta con sesión, sin cuenta elegida.

const id = encodeURIComponent;

export const teamApi = {
  get: () => builderApiClient.get<TeamResponse>("/team"),
  invite: (request: CreateInvitationRequest) => builderApiClient.post<InvitationLinkResponse>("/team/invitations", request),
  renew: (invitationId: string) => builderApiClient.post<InvitationLinkResponse>(`/team/invitations/${id(invitationId)}/renew`),
  revoke: (invitationId: string) => builderApiClient.delete(`/team/invitations/${id(invitationId)}`),
  changeRole: (userId: string, role: TeamRole) => builderApiClient.patch<TeamResponse>(`/team/members/${id(userId)}`, { role }),
  remove: (userId: string) => builderApiClient.delete(`/team/members/${id(userId)}`),
  preview: (token: string) => builderApiClient.get<InvitationPreviewResponse>(`/invitations/${id(token)}`),
  accept: (token: string) => builderApiClient.post<AcceptInvitationResponse>(`/me/invitations/${id(token)}/accept`)
};

/** El enlace que se comparte: abre la página de la invitación en esta misma app. */
export function invitationUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}
