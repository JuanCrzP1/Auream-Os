import { activeTenantStore } from "@shared/auth/tenant/activeTenantStore";

// ---------------------------------------------------------------------------
// La moneda elegida en el Dashboard se recuerda en este navegador, aparte
// para cada cuenta: al volver al Dashboard (desde el menú, otro día) se ve en
// la misma moneda. Elegir la del negocio la olvida (vuelve a la automática).
// Un enlace con `currency` manda sobre lo recordado. La API ignora un código
// que no pueda convertir, así que un valor viejo nunca rompe nada.
// ---------------------------------------------------------------------------

const keyOf = () => `auream.dashboard.currency.${activeTenantStore.read() ?? "default"}`;

export function rememberedCurrency(): string | null {
  try {
    const value = window.localStorage.getItem(keyOf());
    return value && /^[A-Z]{3}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function rememberCurrency(code: string | null): void {
  try {
    if (code) window.localStorage.setItem(keyOf(), code);
    else window.localStorage.removeItem(keyOf());
  } catch {
    // Navegador privado o sin almacenamiento: solo dura esta visita.
  }
}

/** La moneda que usa el informe sin elegir ninguna (para marcar «La de tu negocio» aunque haya otra elegida). */
export function rememberedAutomatic(): string | null {
  try {
    const value = window.localStorage.getItem(`${keyOf()}.auto`);
    return value && /^[A-Z]{3}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function rememberAutomatic(code: string): void {
  try {
    window.localStorage.setItem(`${keyOf()}.auto`, code);
  } catch {
    // idem
  }
}
