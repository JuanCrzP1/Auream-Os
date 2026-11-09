import { useActiveTenant } from "@shared/auth/tenant/ActiveTenantContext";

/**
 * En qué cuenta se autoriza al agente. Con una sola cuenta solo la muestra;
 * con varias deja elegirla (cambia la cuenta activa, como en la app).
 */
export function ConsentAccount() {
  const { state, activeTenantId, selectTenant } = useActiveTenant();
  if (state.status !== "ready") return null;
  const active = state.tenants.find((tenant) => tenant.tenantId === activeTenantId);
  return (
    <div className="oauth-consent__account">
      <span className="ui-muted">Cuenta</span>
      {state.tenants.length > 1 ? (
        <select className="ui-input" aria-label="Cuenta" value={activeTenantId ?? ""} onChange={(event) => selectTenant(event.target.value)}>
          {active ? null : <option value="">Elige una cuenta…</option>}
          {state.tenants.map((tenant) => (
            <option key={tenant.tenantId} value={tenant.tenantId}>
              {tenant.tenantName}
            </option>
          ))}
        </select>
      ) : (
        <strong>{active?.tenantName ?? "—"}</strong>
      )}
    </div>
  );
}
