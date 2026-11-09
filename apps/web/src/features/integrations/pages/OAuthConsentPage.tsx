import "@shared/ui/controls/controls.css";
import { Link, useLocation } from "react-router-dom";
import { useActiveTenant } from "@shared/auth/tenant/ActiveTenantContext";
import { StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { PermissionMatrix } from "../mcp/PermissionMatrix";
import { ConsentAccount } from "../mcp/consent/ConsentAccount";
import { ConsentFrame } from "../mcp/consent/ConsentFrame";
import { ConsentHandshake } from "../mcp/consent/ConsentHandshake";
import { useOAuthConsent } from "../mcp/consent/useOAuthConsent";

/**
 * `/oauth/authorize` — donde un agente (Claude en la web o en la app de
 * escritorio) pide acceso a la cuenta. El usuario ya inició sesión (si no,
 * pasó por el inicio de sesión y volvió aquí con la misma consulta), elige la
 * cuenta y los permisos, y autoriza o cancela: en ambos casos vuelve al agente.
 */
export function OAuthConsentPage({ navigate }: { readonly navigate?: (url: string) => void }) {
  const location = useLocation();
  const { state: tenants, activeTenantId } = useActiveTenant();
  // Se pregunta a la API cuando la cuenta está lista (con la sesión ya restaurada), no antes.
  const consent = useOAuthConsent(location.search, tenants.status === "ready" ? activeTenantId : null, navigate);
  const { state } = consent;

  if (tenants.status === "ready" && !activeTenantId) {
    return (
      <ConsentFrame>
        <h1 className="oauth-consent__title">¿En qué cuenta conectas el agente?</h1>
        <ConsentAccount />
      </ConsentFrame>
    );
  }
  if (tenants.status === "error" || state.status === "error") {
    const message = tenants.status === "error" ? tenants.message : state.status === "error" ? state.message : "";
    return (
      <ConsentFrame>
        <StateCard icon={StateIcons.offline} tone="warning" role="alert" title="No se pudo cargar la solicitud" description={message} actions={<button type="button" className="ui-btn ui-btn--primary" onClick={() => window.location.reload()}>Reintentar</button>} />
      </ConsentFrame>
    );
  }
  if (state.status === "loading") {
    return (
      <ConsentFrame busy>
        <p className="oauth-consent__lead" role="status">Cargando la solicitud…</p>
      </ConsentFrame>
    );
  }
  if (state.status === "forbidden") {
    return (
      <ConsentFrame>
        <StateCard icon={StateIcons.lock} tone="warning" title="No puedes autorizar agentes en esta cuenta" description="Solo los dueños y administradores de la cuenta pueden conectar agentes de IA. Pídele a uno que lo haga." />
        <ConsentAccount />
      </ConsentFrame>
    );
  }
  if (state.status === "invalid") {
    return (
      <ConsentFrame>
        <StateCard
          icon={StateIcons.lock}
          tone="warning"
          role="alert"
          title="Esta solicitud no es válida"
          description={state.message}
          actions={state.redirectTo ? <a className="ui-btn ui-btn--primary" href={state.redirectTo}>Volver al agente</a> : <Link className="ui-btn ui-btn--primary" to="/integrations/mcp">Ir a Agentes de IA</Link>}
        />
      </ConsentFrame>
    );
  }

  return (
    <ConsentFrame busy={consent.sending !== null} header={<ConsentHandshake clientName={state.clientName} />}>
      <h1 className="oauth-consent__title">«{state.clientName}» quiere conectarse a tu cuenta de Auream</h1>
      <p className="oauth-consent__lead">Podrá leer y actuar por ti, solo con lo que marques aquí.</p>
      <ConsentAccount />
      <PermissionMatrix legend="Qué podrá hacer" value={consent.permissions} onChange={consent.setPermissions} />
      <p className="oauth-consent__note">
        Al terminar vuelves a <strong>{state.redirectHost}</strong>. Puedes quitarle el acceso cuando quieras en Integraciones → Agentes de IA (MCP).
      </p>
      {consent.error ? <p className="ui-error" role="alert">{consent.error}</p> : null}
      <div className="oauth-consent__actions">
        <button type="button" className="ui-btn ui-btn--ghost" disabled={consent.sending !== null} onClick={() => void consent.decide(false)}>
          {consent.sending === "deny" ? "Cancelando…" : "Cancelar"}
        </button>
        <button type="button" className="ui-btn ui-btn--primary" disabled={!consent.canApprove} onClick={() => void consent.decide(true)}>
          {consent.sending === "approve" ? "Autorizando…" : "Autorizar"}
        </button>
      </div>
    </ConsentFrame>
  );
}
