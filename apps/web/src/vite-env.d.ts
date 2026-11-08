/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base de la API. Obligatoria en builds de producción. */
  readonly VITE_API_BASE_URL?: string;
  /**
   * API key de desarrollo local. Sólo se lee cuando `import.meta.env.DEV` es true,
   * de modo que nunca queda compilada en un build de producción.
   */
  readonly VITE_DEV_API_KEY?: string;
  /**
   * Dirección oficial de la app (p. ej. `https://auream-os.vercel.app`). Solo
   * en producción: si la app se abre desde otra dirección, redirige a esta.
   */
  readonly VITE_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
