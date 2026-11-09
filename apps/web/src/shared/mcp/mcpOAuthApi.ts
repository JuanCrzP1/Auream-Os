import { builderApiClient } from "@shared/http/builderApiClient";
import type { OAuthAuthorizeDecision, OAuthAuthorizeDecisionRequest, OAuthAuthorizeDescription, OAuthAuthorizeParams } from "@contracts/McpOAuthContracts";

// Autorización OAuth de un agente (Claude web y escritorio) en la cuenta activa.

export function describeAuthorization(params: OAuthAuthorizeParams): Promise<OAuthAuthorizeDescription> {
  return builderApiClient.get<OAuthAuthorizeDescription>(`/oauth/authorize/request?${new URLSearchParams(params as Record<string, string>).toString()}`);
}

export function decideAuthorization(request: OAuthAuthorizeDecisionRequest): Promise<OAuthAuthorizeDecision> {
  return builderApiClient.post<OAuthAuthorizeDecision>("/oauth/authorize/decision", request);
}
