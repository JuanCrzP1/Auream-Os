/**
 * AuthSession — la sesión tal como la ve el frontend.
 *
 * `tenantId` no forma parte de la sesión: un usuario puede pertenecer a varios
 * tenants y el activo se elige aparte (ver `tenant/ActiveTenantContext`).
 */
export interface AuthSession {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
}

export type SessionState =
  | { readonly status: "loading" }
  | { readonly status: "authenticated"; readonly session: AuthSession }
  | { readonly status: "anonymous" };
