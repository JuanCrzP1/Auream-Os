import { useActiveTenant } from "@shared/auth/tenant/ActiveTenantContext";
import "../styles/tenant-selector.css";

/**
 * Selección del espacio de trabajo activo cuando hay más de uno.
 *
 * Con un único tenant no se muestra: ya quedó seleccionado automáticamente.
 */
export function TenantSelector() {
  const { state, activeTenantId, selectTenant } = useActiveTenant();

  if (state.status !== "ready" || state.tenants.length <= 1) {
    return null;
  }

  return (
    <label className="tenant-selector">
      <span className="tenant-selector__label">Espacio</span>
      <select
        className="tenant-selector__select"
        value={activeTenantId ?? ""}
        onChange={(event) => selectTenant(event.target.value)}
      >
        <option value="" disabled>
          Selecciona un espacio
        </option>
        {state.tenants.map((tenant) => (
          <option key={tenant.tenantId} value={tenant.tenantId}>
            {tenant.tenantName}
          </option>
        ))}
      </select>
    </label>
  );
}
