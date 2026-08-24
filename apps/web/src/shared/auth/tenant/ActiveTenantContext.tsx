import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { TenantMembershipSummary } from "@contracts/TenancyContracts";
import { useAuth } from "../context/AuthContext";
import { activeTenantStore } from "./activeTenantStore";
import { ensureOnboarding, fetchMyTenants } from "./fetchMyTenants";

/**
 * Tenant activo del usuario.
 *
 * Responsabilidad única: saber a qué tenants pertenece y cuál está activo.
 * Con uno solo lo selecciona automáticamente; con varios exige elección.
 */

type TenantState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly tenants: ReadonlyArray<TenantMembershipSummary> }
  | { readonly status: "error"; readonly message: string };

interface ActiveTenantContextValue {
  readonly state: TenantState;
  readonly activeTenantId: string | null;
  readonly selectTenant: (tenantId: string) => void;
}

const ActiveTenantContext = createContext<ActiveTenantContextValue | null>(null);

export function ActiveTenantProvider({ children }: { children: ReactNode }) {
  const { state: authState } = useAuth();
  const [state, setState] = useState<TenantState>({ status: "loading" });
  const [activeTenantId, setActiveTenantId] = useState<string | null>(activeTenantStore.read());

  const selectTenant = useCallback((tenantId: string) => {
    activeTenantStore.write(tenantId);
    setActiveTenantId(tenantId);
  }, []);

  useEffect(() => {
    if (authState.status !== "authenticated") {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        await ensureOnboarding();
        const result = await fetchMyTenants();

        if (cancelled) return;

        setState({ status: "ready", tenants: result.tenants });

        const stored = activeTenantStore.read();
        const storedIsValid = result.tenants.some((t) => t.tenantId === stored);

        if (storedIsValid) {
          setActiveTenantId(stored);
        } else if (result.tenants.length === 1) {
          selectTenant(result.tenants[0]!.tenantId);
        } else {
          activeTenantStore.clear();
          setActiveTenantId(null);
        }
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: "No se pudieron cargar tus espacios de trabajo." });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [authState.status, selectTenant]);

  return (
    <ActiveTenantContext.Provider value={{ state, activeTenantId, selectTenant }}>
      {children}
    </ActiveTenantContext.Provider>
  );
}

export function useActiveTenant(): ActiveTenantContextValue {
  const value = useContext(ActiveTenantContext);

  if (!value) {
    throw new Error("useActiveTenant debe usarse dentro de ActiveTenantProvider");
  }

  return value;
}
