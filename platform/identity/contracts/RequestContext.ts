export type AuthMethod = "jwt" | "api_key";

export interface RequestContext {
  readonly tenantId: string;
  readonly actorId: string;
  readonly authMethod: AuthMethod;
  readonly requestId: string;
  readonly scopes: ReadonlyArray<string>;
}
