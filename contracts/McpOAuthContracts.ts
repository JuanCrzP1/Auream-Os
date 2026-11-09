import type { McpPermissions } from "./McpContracts";

// ---------------------------------------------------------------------------
// Autorización OAuth de un agente MCP (Claude en la web y en la app de
// escritorio) — contrato entre la API y la pantalla de consentimiento.
//
// El agente abre `/oauth/authorize?…` en Auream; la pantalla le pregunta a la
// API qué agente es (`describe`) y, cuando el usuario decide, le manda la
// decisión con los permisos elegidos. La API responde a dónde volver.
// ---------------------------------------------------------------------------

/** Los parámetros con que el agente abrió la autorización, tal cual. */
export type OAuthAuthorizeParams = Readonly<Record<string, string>>;

export type OAuthAuthorizeDescription =
  | {
      readonly status: "ready";
      /** Cómo se presenta el agente (p. ej. «Claude»). */
      readonly clientName: string;
      /** El dominio al que se vuelve al terminar (p. ej. `claude.ai`). */
      readonly redirectHost: string;
    }
  | {
      readonly status: "invalid";
      readonly message: string;
      /** Si el error se puede devolver al agente, a dónde volver; si no, `null`. */
      readonly redirectTo: string | null;
    };

export interface OAuthAuthorizeDecisionRequest {
  readonly params: OAuthAuthorizeParams;
  readonly approve: boolean;
  /** Los permisos que se le dan (solo al autorizar). */
  readonly permissions?: McpPermissions;
}

export interface OAuthAuthorizeDecision {
  /** A dónde mandar el navegador: el agente con su código, o con el rechazo. */
  readonly redirectTo: string;
}
