import { useCallback, useEffect, useMemo, useState } from "react";
import type { OAuthAuthorizeParams } from "@contracts/McpOAuthContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { RequestError } from "@shared/http/RequestError";
import { decideAuthorization, describeAuthorization } from "@shared/mcp/mcpOAuthApi";
import { DEFAULT_PERMISSIONS, hasAnyAccess, type PermissionDraft } from "../PermissionMatrix";

export type ConsentState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly clientName: string; readonly redirectHost: string }
  | { readonly status: "invalid"; readonly message: string; readonly redirectTo: string | null }
  | { readonly status: "forbidden" }
  | { readonly status: "error"; readonly message: string };

/**
 * useOAuthConsent — la autorización de un agente en la cuenta activa: qué
 * agente pide acceso (según los parámetros con que abrió la página), los
 * permisos que se le dan y la decisión. Al decidir, el navegador vuelve al
 * agente (`navigate`, por defecto `location.assign`).
 */
export function useOAuthConsent(search: string, tenantId: string | null, navigate: (url: string) => void = (url) => window.location.assign(url)) {
  const params = useMemo<OAuthAuthorizeParams>(() => Object.fromEntries(new URLSearchParams(search)), [search]);
  const [state, setState] = useState<ConsentState>({ status: "loading" });
  const [permissions, setPermissions] = useState<PermissionDraft>(DEFAULT_PERMISSIONS);
  const [sending, setSending] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setState({ status: "loading" });
    describeAuthorization(params)
      .then((description) => {
        if (!cancelled) setState(description.status === "ready" ? description : { status: "invalid", message: description.message, redirectTo: description.redirectTo });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState(e instanceof RequestError && e.status === 403 ? { status: "forbidden" } : { status: "error", message: apiErrorMessage(e, "No se pudo cargar la solicitud. Inténtalo de nuevo.") });
      });
    return () => {
      cancelled = true;
    };
  }, [params, tenantId]);

  const decide = useCallback(
    async (approve: boolean) => {
      setSending(approve ? "approve" : "deny");
      setError(null);
      try {
        const { redirectTo } = await decideAuthorization({ params, approve, ...(approve ? { permissions } : {}) });
        navigate(redirectTo);
      } catch (e) {
        setError(apiErrorMessage(e, "No se pudo completar la autorización. Inténtalo de nuevo."));
        setSending(null);
      }
    },
    [navigate, params, permissions]
  );

  return { state, permissions, setPermissions, canApprove: hasAnyAccess(permissions) && sending === null, sending, error, decide };
}
