import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CompanyResponse, MyProfileResponse } from "@contracts/AccountContracts";
import { useAuth } from "@shared/auth/context/AuthContext";
import { useActiveTenant } from "@shared/auth/tenant/ActiveTenantContext";
import { fetchCompany, fetchMyProfile } from "./accountApi";

/**
 * La cuenta de quien usa la app: su perfil (nombre, foto) y la empresa activa
 * (nombre, logo). Responsabilidad única: cargarlos una vez y compartirlos, para
 * que la tarjeta de la barra lateral, Mi perfil y Empresa muestren siempre lo
 * mismo (cambiar la foto en Mi perfil la cambia al instante en la tarjeta).
 *
 * Si algo no carga, la app sigue: la tarjeta usa el nombre del registro y las
 * iniciales.
 */

interface AccountContextValue {
  readonly profile: MyProfileResponse | null;
  readonly company: CompanyResponse | null;
  /** Nombre visible: el del perfil o, si no lo cambió, el del registro. */
  readonly displayName: string;
  readonly email: string;
  readonly setProfile: (profile: MyProfileResponse) => void;
  readonly setCompany: (company: CompanyResponse) => void;
  readonly reload: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const RETRIES = 3;

export function AccountProvider({ children }: { children: ReactNode }) {
  const { state: auth } = useAuth();
  const { activeTenantId } = useActiveTenant();
  const [profile, setProfile] = useState<MyProfileResponse | null>(null);
  const [company, setCompany] = useState<CompanyResponse | null>(null);
  const authenticated = auth.status === "authenticated";

  /** `true` si cargó todo lo que correspondía. */
  const load = useCallback(async (): Promise<boolean> => {
    if (!authenticated) return true;
    const [nextProfile, nextCompany] = await Promise.all([
      fetchMyProfile().catch(() => null),
      activeTenantId ? fetchCompany().catch(() => null) : Promise.resolve(null)
    ]);
    if (nextProfile) setProfile(nextProfile);
    if (nextCompany) setCompany(nextCompany);
    return nextProfile !== null && (nextCompany !== null || !activeTenantId);
  }, [authenticated, activeTenantId]);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  useEffect(() => {
    if (!authenticated) {
      setProfile(null);
      setCompany(null);
      return;
    }
    // Un fallo pasajero (la sesión recién renovada, la red) se reintenta solo: 2 s, 4 s y 8 s.
    let cancelled = false;
    let timer: number | undefined;
    const attempt = async (n: number) => {
      const done = await load();
      if (!done && !cancelled && n < RETRIES) timer = window.setTimeout(() => void attempt(n + 1), 2_000 * 2 ** n);
    };
    void attempt(0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authenticated, load]);

  const session = auth.status === "authenticated" ? auth.session : null;
  const value = useMemo<AccountContextValue>(
    () => ({
      profile,
      company,
      displayName: profile?.displayName || session?.name || session?.email || "",
      email: session?.email ?? "",
      setProfile,
      setCompany,
      reload
    }),
    [profile, company, session, reload]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount debe usarse dentro de AccountProvider");
  return value;
}
