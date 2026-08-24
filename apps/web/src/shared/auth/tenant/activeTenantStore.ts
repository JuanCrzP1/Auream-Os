/**
 * Tenant activo seleccionado por el usuario.
 *
 * Se recuerda entre recargas por comodidad, pero NO es una fuente de autoridad:
 * el servidor valida siempre la selección contra una membership activa. Si el
 * valor guardado ya no vale, la API responde 403 y se limpia.
 */

const STORAGE_KEY = "bots-ai-active-tenant";

export const activeTenantStore = {
  read(): string | null {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },

  write(tenantId: string): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, tenantId);
    } catch {
      // Sin almacenamiento disponible se sigue funcionando: el tenant se
      // vuelve a resolver en cada carga.
    }
  },

  clear(): void {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // idem
    }
  }
};
